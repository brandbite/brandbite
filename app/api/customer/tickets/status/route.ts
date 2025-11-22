// -----------------------------------------------------------------------------
// @file: app/api/customer/tickets/status/route.ts
// @purpose: Update ticket status for customer board (kanban)
// @version: v1.5.0
// @status: active
// @lastUpdate: 2025-11-22
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import {
  canMoveTicketsOnBoard,
  canMarkTicketsDoneForCompany,
  normalizeCompanyRole,
} from "@/lib/permissions/companyRoles";

type PatchPayload = {
  ticketId?: string;
  status?: string;
};

function isValidTicketStatus(value: unknown): value is TicketStatus {
  if (typeof value !== "string") return false;
  return (
    value === "TODO" ||
    value === "IN_PROGRESS" ||
    value === "IN_REVIEW" ||
    value === "DONE"
  );
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    const isSiteAdmin =
      user.role === "SITE_OWNER" || user.role === "SITE_ADMIN";

    // Only customers + site admins can use this endpoint
    if (!isSiteAdmin && user.role !== "CUSTOMER") {
      return NextResponse.json(
        {
          error:
            "Only customers or site administrators can update ticket status from this endpoint.",
        },
        { status: 403 },
      );
    }

    const body = (await req.json()) as PatchPayload;
    const ticketId = body.ticketId;
    const requestedStatus = body.status;

    if (!ticketId || !requestedStatus) {
      return NextResponse.json(
        { error: "Both ticketId and status are required." },
        { status: 400 },
      );
    }

    if (!isValidTicketStatus(requestedStatus)) {
      return NextResponse.json(
        { error: "Invalid ticket status." },
        { status: 400 },
      );
    }

    const nextStatus = requestedStatus as TicketStatus;

    // -------------------------------------------------------------------------
    // Guard: this endpoint CANNOT move tickets into IN_PROGRESS
    // For everyone (customers AND admins).
    //
    // IN_PROGRESS is controlled only via the designer workflow API,
    // which enforces plan.maxConcurrentInProgressTickets.
    // -------------------------------------------------------------------------

    if (nextStatus === TicketStatus.IN_PROGRESS) {
      return NextResponse.json(
        {
          error:
            "Tickets cannot be moved into In progress from this board. Your designer will move tickets into In progress when they start working on them.",
        },
        { status: 400 },
      );
    }

    // -------------------------------------------------------------------------
    // Load ticket with proper scoping
    // -------------------------------------------------------------------------

    const where =
      user.role === "CUSTOMER" && user.activeCompanyId
        ? {
            id: ticketId,
            companyId: user.activeCompanyId,
          }
        : {
            id: ticketId,
          };

    const ticket = await prisma.ticket.findFirst({
      where,
      select: {
        id: true,
        status: true,
        companyId: true,
        designerId: true,
        jobType: {
          select: {
            id: true,
            designerPayoutTokens: true,
          },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket not found." },
        { status: 404 },
      );
    }

    // -------------------------------------------------------------------------
    // Board-level permission: can this user move tickets at all?
    // - Site admins: always yes (except IN_PROGRESS guard above)
    // - Customers: based on companyRole
    // -------------------------------------------------------------------------

    const normalizedCompanyRole = normalizeCompanyRole(
      user.companyRole ?? null,
    );

    if (!isSiteAdmin) {
      if (!canMoveTicketsOnBoard(normalizedCompanyRole)) {
        return NextResponse.json(
          {
            error:
              "You don't have permission to move tickets on the board for this company.",
          },
          { status: 403 },
        );
      }
    }

    // -------------------------------------------------------------------------
    // DONE transition: special permission rule + designer payout
    // -------------------------------------------------------------------------

    const isDoneTransition =
      ticket.status !== TicketStatus.DONE &&
      nextStatus === TicketStatus.DONE;

    if (isDoneTransition) {
      const canMarkDone = canMarkTicketsDoneForCompany(
        user.role,
        normalizedCompanyRole,
      );

      if (!canMarkDone) {
        return NextResponse.json(
          {
            error:
              "You don't have permission to mark this ticket as DONE. Please ask your company owner or project manager.",
          },
          { status: 403 },
        );
      }

      // Designer payout on DONE (idempotent)
      const hasDesigner = !!ticket.designerId;
      const payoutTokens = ticket.jobType?.designerPayoutTokens ?? 0;

      if (hasDesigner && payoutTokens > 0) {
        // Aynı ticket için daha önce payout yazılmış mı?
        const existingPayout = await prisma.tokenLedger.findFirst({
          where: {
            userId: ticket.designerId!,
            companyId: ticket.companyId,
            reason: "DESIGNER_JOB_PAYOUT",
            metadata: {
              path: ["ticketId"],
              equals: ticket.id,
            } as any,
          },
        });

        if (!existingPayout) {
          await prisma.tokenLedger.create({
            data: {
              userId: ticket.designerId!,
              companyId: ticket.companyId,
              direction: "CREDIT",
              amount: payoutTokens,
              reason: "DESIGNER_JOB_PAYOUT",
              metadata: {
                ticketId: ticket.id,
                jobTypeId: ticket.jobType?.id ?? null,
                source: "CUSTOMER_DONE",
              },
            },
          });
        }
      }
    }

    // -------------------------------------------------------------------------
    // Normal status update (TODO / IN_REVIEW / DONE)
    // -------------------------------------------------------------------------

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: nextStatus,
      },
      select: {
        id: true,
        status: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error(
      "[PATCH /api/customer/tickets/status] error",
      error,
    );
    return NextResponse.json(
      { error: "Failed to update ticket status" },
      { status: 500 },
    );
  }
}
