// -----------------------------------------------------------------------------
// @file: app/api/customer/tickets/status/route.ts
// @purpose: Update ticket status for customer board (kanban)
// @version: v1.6.0
// @status: active
// @lastUpdate: 2025-11-23
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { TicketStatus, LedgerDirection } from "@prisma/client";
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

    // -------------------------------------------------------------------------
    // Only customers + site admins can use this endpoint
    // -------------------------------------------------------------------------

    const isSiteAdmin =
      user.role === "SITE_OWNER" || user.role === "SITE_ADMIN";

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
    // Scope ticket by company for customers
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
            name: true,
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

    const currentStatus = ticket.status;

    // Short-circuit: nothing to do
    if (currentStatus === nextStatus) {
      return NextResponse.json(
        {
          id: ticket.id,
          status: ticket.status,
          // Simple updatedAt dummy; real value comes from DB when frontend refetches
          updatedAt: new Date().toISOString(),
        },
        { status: 200 },
      );
    }

    // -------------------------------------------------------------------------
    // Board-level permission: can this user move tickets at all?
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
    // New rules for customer board transitions (hibrit yapı)
    //
    // - Customer ticket oluşturur → TODO
    // - IN_PROGRESS → sadece designer (customer buraya geçiremez)
    // - IN_REVIEW → designer alır (işi review’a gönderir)
    // - Customer:
    //     * IN_REVIEW → DONE  (işi onaylar)
    //     * IN_REVIEW → IN_PROGRESS (revize ister, ticket geri açılır)
    // -------------------------------------------------------------------------

    // 1) Customer hiçbir şekilde REVIEW'a taşıyamaz
    if (nextStatus === TicketStatus.IN_REVIEW) {
      return NextResponse.json(
        {
          error:
            "Only your design team can move tickets into review. Ask your designer to send the ticket for review.",
        },
        { status: 400 },
      );
    }

    // 2) IN_REVIEW → IN_PROGRESS revize path'i
    const isReviewToInProgress =
      currentStatus === TicketStatus.IN_REVIEW &&
      nextStatus === TicketStatus.IN_PROGRESS;

    if (nextStatus === TicketStatus.IN_PROGRESS && !isReviewToInProgress) {
      return NextResponse.json(
        {
          error:
            "Tickets can only be moved back into In progress from review. To start work on a ticket, your designer needs to pick it up.",
        },
        { status: 400 },
      );
    }

    // 3) DONE transition: sadece IN_REVIEW → DONE
    const isDoneTransition =
      currentStatus !== TicketStatus.DONE &&
      nextStatus === TicketStatus.DONE;

    if (isDoneTransition && currentStatus !== TicketStatus.IN_REVIEW) {
      return NextResponse.json(
        {
          error:
            "This ticket must be in review before you can mark it as done.",
        },
        { status: 400 },
      );
    }

    // DONE için ek yetki kontrolü (Owner / PM vs.)
    if (isDoneTransition) {
      const canMarkDone = canMarkTicketsDoneForCompany(
        user.role,
        normalizedCompanyRole,
      );

      if (!canMarkDone && !isSiteAdmin) {
        return NextResponse.json(
          {
            error:
              "You don't have permission to mark this ticket as DONE. Please ask your company owner or project manager.",
          },
          { status: 403 },
        );
      }
    }

    // -------------------------------------------------------------------------
    // Plan limiti: IN_REVIEW → IN_PROGRESS revize'de de kontrol et
    // -------------------------------------------------------------------------

    if (isReviewToInProgress) {
      const company = await prisma.company.findUnique({
        where: { id: ticket.companyId },
        select: {
          id: true,
          name: true,
          plan: {
            select: {
              id: true,
              name: true,
              maxConcurrentInProgressTickets: true,
            },
          },
        },
      });

      const plan = company?.plan;

      if (plan && plan.maxConcurrentInProgressTickets > 0) {
        const currentInProgressCount = await prisma.ticket.count({
          where: {
            companyId: ticket.companyId,
            status: TicketStatus.IN_PROGRESS,
          },
        });

        if (
          currentInProgressCount >= plan.maxConcurrentInProgressTickets
        ) {
          return NextResponse.json(
            {
              error:
                "This company has reached its limit for active tickets in progress.",
              details: {
                plan: plan.name,
                maxConcurrentInProgress:
                  plan.maxConcurrentInProgressTickets,
                currentInProgress: currentInProgressCount,
              },
            },
            { status: 400 },
          );
        }
      }
    }

    // -------------------------------------------------------------------------
    // Status update + (opsiyonel) designer payout (DONE’da)
    // -------------------------------------------------------------------------

    const updated = await prisma.$transaction(async (tx) => {
      // 1) Designer payout (DONE olduğunda)
      if (isDoneTransition) {
        const hasDesigner =
          !!ticket.designerId && !!ticket.jobType?.designerPayoutTokens;

        if (
          hasDesigner &&
          ticket.jobType!.designerPayoutTokens > 0 &&
          ticket.designerId
        ) {
          const existingPayout = await tx.tokenLedger.findFirst({
            where: {
              ticketId: ticket.id,
              userId: ticket.designerId,
              direction: LedgerDirection.CREDIT,
              reason: "DESIGNER_JOB_PAYOUT",
            },
            select: { id: true },
          });

          if (!existingPayout) {
            await tx.tokenLedger.create({
              data: {
                companyId: ticket.companyId,
                ticketId: ticket.id,
                userId: ticket.designerId,
                direction: LedgerDirection.CREDIT,
                amount: ticket.jobType!.designerPayoutTokens,
                reason: "DESIGNER_JOB_PAYOUT",
                notes: `Automatic payout for completed ticket`,
              },
            });
          }
        }
      }

      // 2) Ticket status update
      const updatedTicket = await tx.ticket.update({
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

      return updatedTicket;
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
