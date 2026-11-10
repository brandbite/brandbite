// -----------------------------------------------------------------------------
// @file: app/api/tickets/[id]/complete/route.ts
// @purpose: Completes a ticket and applies token movements (company debit + creative credit)
// @version: v1.0.0
// @lastUpdate: 2025-11-13
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { completeTicketAndApplyTokens } from "@/lib/token-engine";
import { prisma } from "@/lib/prisma";
import { recordTicketEvent } from "@/lib/tickets/ticket-events";
import { createNotification } from "@/lib/notifications";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";
import { autoStopTimersOnTicket } from "@/lib/tickets/auto-timer";

/**
 * Usage:
 * POST /api/tickets/:id/complete
 *
 * Authorization: site admins only. This endpoint marks the ticket DONE and
 * mints the creative payout without checking the ticket's status, so it must
 * not be reachable by the creative who gets paid — that let an assigned
 * creative complete their own ticket from any status and skip customer
 * approval. Customers approve through /api/customer/tickets/status, which
 * enforces the board state machine (IN_REVIEW → DONE). No UI calls this.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: ticketId } = await context.params;

  if (!ticketId) {
    return NextResponse.json({ error: "Missing request id in route params" }, { status: 400 });
  }

  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const exists = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, status: true },
    });
    if (!exists) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const result = await completeTicketAndApplyTokens(ticketId);

    if (result.alreadyCompleted) {
      return NextResponse.json(
        {
          message: "Request already completed or already processed for JOB_PAYMENT",
          ticket: result.ticket,
          alreadyCompleted: true,
        },
        { status: 409 },
      );
    }

    await autoStopTimersOnTicket(ticketId);

    // This path doesn't stamp completedAt, so the Activity tab needs its own record.
    await recordTicketEvent({
      ticketId,
      actorId: user.id,
      type: "STATUS_CHANGED",
      metadata: { from: exists.status, to: "DONE" },
    });

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
          title: "Request completed",
          message: `"${ticketMeta.title}" has been marked as done`,
          ticketId,
        });
      }
      createNotification({
        userId: ticketMeta.createdById,
        type: "TICKET_COMPLETED",
        title: "Request completed",
        message: `"${ticketMeta.title}" has been marked as done`,
        ticketId,
      });
    }

    return NextResponse.json(
      {
        message: "Request completed and tokens applied successfully",
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
