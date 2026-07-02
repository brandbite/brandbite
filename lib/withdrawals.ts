// -----------------------------------------------------------------------------
// @file: lib/withdrawals.ts
// @purpose: Single source of truth for the withdrawal token debit.
//
// A creative withdrawal has two money-relevant transitions: APPROVE (the
// platform commits to pay) and MARK_PAID (money actually leaves). The token
// DEBIT must happen exactly once, and — across every code path that can pay a
// withdrawal — at the SAME transition, or the flows can double-debit (debit at
// both approve and paid) or zero-debit (debit at neither).
//
// Canonical rule: the debit happens at MARK_PAID, here. APPROVE never debits.
// Both the PATCH /api/admin/withdrawals flow and the POST
// /api/admin/withdrawals/[id]/mark-paid flow call this, so they behave
// identically and can't diverge.
// -----------------------------------------------------------------------------

import { LedgerDirection, Prisma, WithdrawalStatus } from "@prisma/client";

/**
 * Atomically mark an APPROVED withdrawal PAID and debit the creative's ledger.
 * Must be called inside a transaction (pass the tx client).
 *
 * Safety properties:
 *  - Guarded flip: claims the row with `updateMany(status: APPROVED)`, so two
 *    concurrent mark-paid calls can't both debit — the loser sees count 0.
 *  - Idempotent by status: a second call on a PAID row throws before debiting.
 *  - Balance floor: refuses to drive the creative's balance negative.
 *
 * Throws `Response` objects so route handlers can forward the status/message
 * directly (matching the existing PATCH handler's error convention).
 */
export async function payApprovedWithdrawal(
  tx: Prisma.TransactionClient,
  withdrawalId: string,
  actorEmail: string,
) {
  const withdrawal = await tx.withdrawal.findUnique({
    where: { id: withdrawalId },
    include: {
      creative: { select: { id: true, email: true, name: true, role: true } },
    },
  });

  if (!withdrawal) {
    throw new Response("Withdrawal not found", { status: 404 });
  }
  if (withdrawal.status === WithdrawalStatus.PAID) {
    throw new Response("Withdrawal is already paid", { status: 422 });
  }
  if (withdrawal.status !== WithdrawalStatus.APPROVED) {
    throw new Response("Withdrawal must be approved before marking as paid", { status: 422 });
  }

  // Race-safe claim: only one caller can flip APPROVED -> PAID.
  const claimed = await tx.withdrawal.updateMany({
    where: { id: withdrawal.id, status: WithdrawalStatus.APPROVED },
    data: { status: WithdrawalStatus.PAID, paidAt: new Date() },
  });
  if (claimed.count === 0) {
    throw new Response("Withdrawal is no longer approved", { status: 409 });
  }

  // Balance re-check — must never debit a creative below zero.
  const [creditAgg, debitAgg] = await Promise.all([
    tx.tokenLedger.aggregate({
      where: { userId: withdrawal.creativeId, direction: LedgerDirection.CREDIT },
      _sum: { amount: true },
    }),
    tx.tokenLedger.aggregate({
      where: { userId: withdrawal.creativeId, direction: LedgerDirection.DEBIT },
      _sum: { amount: true },
    }),
  ]);
  const balanceBefore = (creditAgg._sum.amount ?? 0) - (debitAgg._sum.amount ?? 0);
  if (balanceBefore < withdrawal.amountTokens) {
    // Roll back the flip above by throwing — the whole tx is undone.
    throw new Response("Creative no longer has enough tokens to pay this withdrawal", {
      status: 400,
    });
  }
  const balanceAfter = balanceBefore - withdrawal.amountTokens;

  await tx.tokenLedger.create({
    data: {
      userId: withdrawal.creativeId,
      direction: LedgerDirection.DEBIT,
      amount: withdrawal.amountTokens,
      reason: "WITHDRAWAL_PAID",
      notes: `Withdrawal ${withdrawal.id} marked as paid by ${actorEmail}`,
      metadata: { withdrawalId: withdrawal.id },
      balanceBefore,
      balanceAfter,
    },
  });

  return tx.withdrawal.findUniqueOrThrow({
    where: { id: withdrawal.id },
    include: {
      creative: { select: { id: true, email: true, name: true, role: true } },
    },
  });
}
