// -----------------------------------------------------------------------------
// @file: app/api/tickets/[id]/complete/route.ts
// @purpose: Completes a ticket and applies token movements (company debit + creative credit)
// @version: v1.0.0
// @lastUpdate: 2025-11-13
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { completeTicketAndApplyTokens } from "@/lib/token-engine";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";

/**
 * Usage:
 * POST /api/tickets/:id/complete
 *
 * Authorization: site admins, or the creative assigned to the ticket. This
 * endpoint mints a creative payout, so it must never be reachable
 * unauthenticated. (Customer-side completion goes through
 * /api/customer/tickets/status, which enforces the board state machine.)
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: ticketId } = await context.params;

  if (!ticketId) {
    return NextResponse.json({ error: "Missing ticket id in route params" }, { status: 400 });
  }

  try {
    const user = await getCurrentUserOrThrow();

    const authTicket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { creativeId: true },
    });
    if (!authTicket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const isSiteAdmin = isSiteAdminRole(user.role);
    const isAssignedCreative = !!authTicket.creativeId && authTicket.creativeId === user.id;
    if (!isSiteAdmin && !isAssignedCreative) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await completeTicketAndApplyTokens(ticketId);

    if (result.alreadyCompleted) {
      return NextResponse.json(
        {
          message: "Ticket already completed or already processed for JOB_PAYMENT",
          ticket: result.ticket,
          alreadyCompleted: true,
        },
        { status: 409 },
      );
    }

    // Fire notifications (fire-and-forget)
    const ticketMeta = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { title: true, createdById: true, creativeId: true },
    });
    if (ticketMeta) {
      if (ticketMeta.creativeId) {
        createNotification({
          userId: ticketMeta.creativeId,
          type: "TICKET_COMPLETED",
          title: "Ticket completed",
          message: `"${ticketMeta.title}" has been marked as done`,
          ticketId,
        });
      }
      createNotification({
        userId: ticketMeta.createdById,
        type: "TICKET_COMPLETED",
        title: "Ticket completed",
        message: `"${ticketMeta.title}" has been marked as done`,
        ticketId,
      });
    }

    return NextResponse.json(
      {
        message: "Ticket completed and tokens applied successfully",
        ticket: result.ticket,
        company: {
          ledgerEntryId: result.companyLedgerEntry?.id ?? null,
          balanceAfter: result.companyBalanceAfter,
        },
        creative: {
          ledgerEntryId: result.creativeLedgerEntry?.id ?? null,
          balanceAfter: result.creativeBalanceAfter,
        },
        alreadyCompleted: false,
      },
      { status: 200 },
    );
  } catch (error) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[POST /api/tickets/:id/complete] error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";

    if (message.startsWith("Ticket not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
