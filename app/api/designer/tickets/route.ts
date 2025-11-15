// -----------------------------------------------------------------------------
// @file: app/api/designer/tickets/route.ts
// @purpose: Designer API for listing and updating assigned tickets (status + payout on DONE)
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-15
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LedgerDirection } from "@prisma/client";
import { getCurrentUserOrThrow } from "@/lib/auth";

type TicketStatusString = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";

// -----------------------------------------------------------------------------
// GET: list tickets assigned to current designer
// -----------------------------------------------------------------------------

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "DESIGNER") {
      return NextResponse.json(
        { error: "Only designers can access designer tickets" },
        { status: 403 },
      );
    }

    const tickets = await prisma.ticket.findMany({
      where: {
        designerId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        jobType: {
          select: {
            id: true,
            name: true,
            tokenCost: true,
            designerPayoutTokens: true,
          },
        },
      },
    });

    const statsByStatus: Record<TicketStatusString, number> = {
      TODO: 0,
      IN_PROGRESS: 0,
      IN_REVIEW: 0,
      DONE: 0,
    };

    for (const t of tickets) {
      const s = t.status as TicketStatusString;
      if (statsByStatus[s] != null) {
        statsByStatus[s] += 1;
      }
    }

    const dto = tickets.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status as TicketStatusString,
      priority: t.priority,
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      companyTicketNumber: t.companyTicketNumber,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      company: t.company
        ? {
            id: t.company.id,
            name: t.company.name,
            slug: t.company.slug,
          }
        : null,
      project: t.project
        ? {
            id: t.project.id,
            name: t.project.name,
            code: t.project.code,
          }
        : null,
      jobType: t.jobType
        ? {
            id: t.jobType.id,
            name: t.jobType.name,
            tokenCost: t.jobType.tokenCost,
            designerPayoutTokens: t.jobType.designerPayoutTokens,
          }
        : null,
    }));

    return NextResponse.json({
      stats: {
        byStatus: statsByStatus,
        total: tickets.length,
      },
      tickets: dto,
    });
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[designer.tickets] GET error", error);
    return NextResponse.json(
      { error: "Failed to load designer tickets" },
      { status: 500 },
    );
  }
}

// -----------------------------------------------------------------------------
// PATCH: update ticket status (and payout designer on first DONE)
// -----------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "DESIGNER") {
      return NextResponse.json(
        { error: "Only designers can update designer tickets" },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);

    const id = body?.id as string | undefined;
    const newStatus = body?.status as TicketStatusString | undefined;

    const allowedStatuses: TicketStatusString[] = [
      "TODO",
      "IN_PROGRESS",
      "IN_REVIEW",
      "DONE",
    ];

    if (!id || !newStatus) {
      return NextResponse.json(
        { error: "Missing id or status" },
        { status: 400 },
      );
    }

    if (!allowedStatuses.includes(newStatus)) {
      return NextResponse.json(
        { error: "Invalid status value" },
        { status: 400 },
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({
        where: { id },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          jobType: {
            select: {
              id: true,
              name: true,
              tokenCost: true,
              designerPayoutTokens: true,
            },
          },
        },
      });

      if (!ticket) {
        throw new Response("Ticket not found", { status: 404 });
      }

      if (ticket.designerId !== user.id) {
        throw new Response("You are not assigned to this ticket", {
          status: 403,
        });
      }

      const previousStatus = ticket.status as TicketStatusString;

      // If status is the same, just return current ticket
      if (previousStatus === newStatus) {
        return ticket;
      }

      // If moving to DONE, and there is a jobType with payout, handle payout
      if (newStatus === "DONE" && ticket.jobType) {
        const payoutTokens =
          ticket.jobType.designerPayoutTokens ?? 0;

        if (payoutTokens > 0) {
          // Check if payout for this ticket was already created
          const existingPayout =
            await tx.tokenLedger.findFirst({
              where: {
                ticketId: ticket.id,
                userId: ticket.designerId ?? undefined,
                reason: "TICKET_COMPLETED_PAYOUT",
              },
            });

          if (!existingPayout && ticket.designerId) {
            // Calculate designer balance before this credit
            const [creditAgg, debitAgg] = await Promise.all([
              tx.tokenLedger.aggregate({
                where: {
                  userId: ticket.designerId,
                  direction: LedgerDirection.CREDIT,
                },
                _sum: { amount: true },
              }),
              tx.tokenLedger.aggregate({
                where: {
                  userId: ticket.designerId,
                  direction: LedgerDirection.DEBIT,
                },
                _sum: { amount: true },
              }),
            ]);

            const totalCredits = creditAgg._sum.amount ?? 0;
            const totalDebits = debitAgg._sum.amount ?? 0;
            const balanceBefore = totalCredits - totalDebits;
            const balanceAfter = balanceBefore + payoutTokens;

            await tx.tokenLedger.create({
              data: {
                userId: ticket.designerId,
                companyId: ticket.companyId,
                ticketId: ticket.id,
                direction: LedgerDirection.CREDIT,
                amount: payoutTokens,
                reason: "TICKET_COMPLETED_PAYOUT",
                notes: `Designer payout for completed ticket ${ticket.id}`,
                balanceBefore,
                balanceAfter,
              },
            });
          }
        }
      }

      const updatedTicket = await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          status: newStatus,
        },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          jobType: {
            select: {
              id: true,
              name: true,
              tokenCost: true,
              designerPayoutTokens: true,
            },
          },
        },
      });

      return updatedTicket;
    });

    const dto = {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      status: updated.status as TicketStatusString,
      priority: updated.priority,
      dueDate: updated.dueDate
        ? updated.dueDate.toISOString()
        : null,
      companyTicketNumber: updated.companyTicketNumber,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      company: updated.company
        ? {
            id: updated.company.id,
            name: updated.company.name,
            slug: updated.company.slug,
          }
        : null,
      project: updated.project
        ? {
            id: updated.project.id,
            name: updated.project.name,
            code: updated.project.code,
          }
        : null,
      jobType: updated.jobType
        ? {
            id: updated.jobType.id,
            name: updated.jobType.name,
            tokenCost: updated.jobType.tokenCost,
            designerPayoutTokens:
              updated.jobType.designerPayoutTokens,
          }
        : null,
    };

    return NextResponse.json({ ticket: dto });
  } catch (error: any) {
    if (error instanceof Response) {
      const text = await error.text();
      return NextResponse.json(
        { error: text || "Request failed" },
        { status: error.status },
      );
    }

    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[designer.tickets] PATCH error", error);
    return NextResponse.json(
      { error: "Failed to update ticket" },
      { status: 500 },
    );
  }
}
