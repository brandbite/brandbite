// -----------------------------------------------------------------------------
// @file: app/api/tickets/[id]/complete/route.ts
// @purpose: Completes a ticket and applies token movements (company debit + designer credit)
// @version: v1.0.0
// @lastUpdate: 2025-11-13
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { completeTicketAndApplyTokens } from "@/lib/token-engine";

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
  context: { params: { id: string } }
) {
  const ticketId = context.params.id;

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