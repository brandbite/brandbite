// -----------------------------------------------------------------------------
// @file: app/api/tickets/[id]/complete/route.ts
// @purpose: Completes a ticket and applies token movements (company debit + designer credit)
// @version: v1.0.0
// @lastUpdate: 2025-11-13
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { completeTicketAndApplyTokens } from "@/lib/token-engine";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

/**
 * Geçici tasarım:
 * - Auth kontrolü yok; BetterAuth entegrasyonu sonrası yalnızca yetkili kullanıcılar
 *   (örn: atanmış designer veya admin) ticket'ı tamamlayabilecek.
 *
 * Kullanım:
 * POST /api/tickets/:id/complete
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: ticketId } = await context.params;

  if (!ticketId) {
    return NextResponse.json(
      { error: "Missing ticket id in route params" },
      { status: 400 }
    );
  }

  try {
    const result = await completeTicketAndApplyTokens(ticketId);

    if (result.alreadyCompleted) {
      return NextResponse.json(
        {
          message: "Ticket already completed or already processed for JOB_PAYMENT",
          ticket: result.ticket,
          alreadyCompleted: true,
        },
        { status: 409 }
      );
    }

    // Fire notifications (fire-and-forget)
    const ticketMeta = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { title: true, createdById: true, designerId: true },
    });
    if (ticketMeta) {
      if (ticketMeta.designerId) {
        createNotification({
          userId: ticketMeta.designerId,
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
        designer: {
          ledgerEntryId: result.designerLedgerEntry?.id ?? null,
          balanceAfter: result.designerBalanceAfter,
        },
        alreadyCompleted: false,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /api/tickets/:id/complete] error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";

    if (message.startsWith("Ticket not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}