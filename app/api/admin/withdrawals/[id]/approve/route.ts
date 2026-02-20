// -----------------------------------------------------------------------------
// @file: app/api/admin/withdrawals/[id]/approve/route.ts
// @purpose: Approve a creative withdrawal and apply token debit
// @version: v1.0.0
// @lastUpdate: 2025-11-13
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, WithdrawalStatus } from "@prisma/client";
import { applyUserLedgerEntry, getUserTokenBalance } from "@/lib/token-engine";

/**
 * POST /api/admin/withdrawals/:id/approve
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json(
      { error: "Missing withdrawal id in route params" },
      { status: 400 }
    );
  }

  try {
    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id },
    });

    if (!withdrawal) {
      return NextResponse.json(
        { error: "Withdrawal not found" },
        { status: 404 }
      );
    }

    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      return NextResponse.json(
        {
          error: "Only PENDING withdrawals can be approved",
          currentStatus: withdrawal.status,
        },
        { status: 400 }
      );
    }

    const balance = await getUserTokenBalance(withdrawal.creativeId);

    if (withdrawal.amountTokens > balance) {
      return NextResponse.json(
        {
          error: "Creative does not have enough tokens at approval time",
          availableBalance: balance,
          requestedAmount: withdrawal.amountTokens,
        },
        { status: 400 }
      );
    }

    // Ledger + status update tek transaction içinde
    const result = await prisma.$transaction(async (tx) => {
      // Ledger DEBIT
      const ledgerResult = await applyUserLedgerEntry({
        userId: withdrawal.creativeId,
        amount: withdrawal.amountTokens,
        direction: "DEBIT",
        reason: "WITHDRAW",
        notes: `Withdrawal approved (id: ${withdrawal.id})`,
        metadata: {
          withdrawalId: withdrawal.id,
        },
      });

      const updated = await tx.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: WithdrawalStatus.APPROVED,
          approvedAt: new Date(),
          metadata: {
            ...((typeof withdrawal.metadata === "object" && withdrawal.metadata !== null && !Array.isArray(withdrawal.metadata)) ? (withdrawal.metadata as Prisma.JsonObject) : {}),
            ledgerEntryId: ledgerResult.ledger.id,
          },
        },
      });

      return {
        updated,
        ledgerEntryId: ledgerResult.ledger.id,
        creativeBalanceAfter: ledgerResult.balanceAfter,
      };
    });

    return NextResponse.json(
      {
        message: "Withdrawal approved and token debit applied",
        withdrawal: result.updated,
        ledgerEntryId: result.ledgerEntryId,
        creativeBalanceAfter: result.creativeBalanceAfter,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /api/admin/withdrawals/:id/approve] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
