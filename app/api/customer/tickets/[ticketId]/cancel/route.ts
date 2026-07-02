// -----------------------------------------------------------------------------
// @file: app/api/customer/tickets/[ticketId]/cancel/route.ts
// @purpose: Customer-initiated soft-cancel + full token refund for a TODO ticket
// @version: v1.0.0
// @status: active
// -----------------------------------------------------------------------------
//
// Why a dedicated endpoint instead of a PATCH that just sets status = CANCELED:
// - Token refund + status flip MUST happen in a single transaction so we can't
//   ever leak a half-cancelled state (status=CANCELED but no REFUND ledger, or
//   vice versa).
// - The action is destructive enough to warrant its own audit trail. A
//   dedicated POST /cancel makes the intent obvious in server logs and in
//   the eventual TicketEvent / AdminAction history.
// - The status PATCH path lets MEMBERs (canCreateTickets) move tickets on the
//   board. Cancel must be tighter (OWNER + PM only) since it spends a refund
//   action against the company ledger. Separating endpoints keeps both
//   permission policies clean.

import { NextRequest, NextResponse } from "next/server";
import { LedgerDirection, TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { normalizeCompanyRole, isCompanyAdminRole } from "@/lib/permissions/companyRoles";
import { getEffectiveTokenValues } from "@/lib/token-engine";

type RouteContext = { params: Promise<{ ticketId: string }> };

export async function POST(_req: NextRequest, ctx: RouteContext) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customers can cancel their own tickets." },
        { status: 403 },
      );
    }

    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "No active company selected." }, { status: 400 });
    }

    // OWNER + PM only — cancelling triggers a refund, which is the same
    // gravity as the original token spend. MEMBER can create tickets but
    // shouldn't be able to claw the tokens back unilaterally.
    const companyRole = normalizeCompanyRole(user.companyRole);
    if (!isCompanyAdminRole(companyRole)) {
      return NextResponse.json(
        {
          error: "Only company owners or project managers can cancel tickets.",
        },
        { status: 403 },
      );
    }

    const { ticketId } = await ctx.params;
    if (!ticketId) {
      return NextResponse.json({ error: "Missing ticketId in route params" }, { status: 400 });
    }

    // Fetch + assert the ticket is cancellable. We read inside the
    // transaction below as well, but a pre-check here gives the client a
    // friendlier error before we open the write transaction.
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, companyId: user.activeCompanyId },
      select: {
        id: true,
        title: true,
        status: true,
        creativeId: true,
        quantity: true,
        tokenCostOverride: true,
        creativePayoutOverride: true,
        companyTicketNumber: true,
        jobType: { select: { id: true, tokenCost: true, creativePayoutTokens: true } },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    }

    if (ticket.status !== TicketStatus.TODO) {
      return NextResponse.json(
        {
          error:
            "Only tickets still in TODO can be cancelled. Once a creative has started work, please contact support.",
          status: ticket.status,
        },
        { status: 409 },
      );
    }

    // Belt-and-braces: TODO + assigned shouldn't be possible (assignment
    // moves to IN_PROGRESS) but if it ever happens we refuse the refund
    // — the assigned creative may already have spent prep time.
    if (ticket.creativeId) {
      return NextResponse.json(
        {
          error: "This ticket has already been assigned to a creative. Please contact support.",
        },
        { status: 409 },
      );
    }

    const { effectiveCost } = getEffectiveTokenValues(ticket);

    // Single transaction: flip status, write REFUND ledger, update company
    // balance. If any step throws, all three are rolled back together.
    const result = await prisma.$transaction(async (tx) => {
      // Conditional update — race safety against a second concurrent
      // cancel call (or a status PATCH landing in between). updateMany
      // with the status guard returns count=0 if it lost the race.
      const flipped = await tx.ticket.updateMany({
        where: { id: ticket.id, status: TicketStatus.TODO, creativeId: null },
        data: { status: TicketStatus.CANCELED },
      });

      if (flipped.count === 0) {
        throw new Error("LOST_RACE");
      }

      // Refund only when there was a cost to begin with. AI tickets and
      // edge cases without a jobType have effectiveCost=0 — we still flip
      // the status (so the row leaves the board) but skip the no-op
      // ledger entry. Symmetric with create-ticket.ts, which also skips
      // the spend when jobType is null.
      let refundedAmount = 0;
      if (effectiveCost > 0) {
        // Atomic increment (not read-then-absolute-set) so a concurrent
        // debit/credit on the same company isn't clobbered. The status flip
        // above already guards against a double refund; this guards the
        // balance value itself against lost updates.
        const company = await tx.company.update({
          where: { id: user.activeCompanyId! },
          data: { tokenBalance: { increment: effectiveCost } },
          select: { tokenBalance: true },
        });

        const balanceAfter = company.tokenBalance;
        const balanceBefore = balanceAfter - effectiveCost;

        await tx.tokenLedger.create({
          data: {
            companyId: user.activeCompanyId!,
            ticketId: ticket.id,
            direction: LedgerDirection.CREDIT,
            amount: effectiveCost,
            reason: "REFUND",
            notes: `Customer cancelled ticket: ${ticket.title}`,
            metadata: {
              cancelledByUserId: user.id,
              cancelledByEmail: user.email,
              companyTicketNumber: ticket.companyTicketNumber,
              originalJobTypeId: ticket.jobType?.id ?? null,
              effectiveCost,
            },
            balanceBefore,
            balanceAfter,
          },
        });

        refundedAmount = effectiveCost;
      }

      return { refundedAmount };
    });

    return NextResponse.json(
      {
        success: true,
        ticketId: ticket.id,
        refundedTokens: result.refundedAmount,
      },
      { status: 200 },
    );
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if (error?.message === "LOST_RACE") {
      // Another request already moved the ticket out of TODO between our
      // pre-check and the transactional flip. Surface a 409 so the client
      // can refresh state instead of retrying blindly.
      return NextResponse.json(
        {
          error: "This ticket was just updated by someone else. Please refresh and try again.",
        },
        { status: 409 },
      );
    }
    console.error("[customer.tickets.cancel] POST error", error);
    return NextResponse.json({ error: "Failed to cancel ticket." }, { status: 500 });
  }
}
