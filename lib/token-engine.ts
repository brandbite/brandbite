// -----------------------------------------------------------------------------
// @file: lib/token-engine.ts
// @purpose: Token accounting helpers for Brandbite (companies, creatives, tickets)
// @version: v2.0.0
// @lastUpdate: 2026-02-20
// -----------------------------------------------------------------------------

import { LedgerDirection, Prisma, TicketStatus } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Human-readable reason codes for token movements.
 */
export type TokenReason =
  | "PLAN_PURCHASE"
  | "PLAN_RENEWAL"
  | "JOB_PAYMENT"
  | "WITHDRAW"
  | "ADMIN_ADJUSTMENT"
  | "REFUND"
  | "CONSULTATION_BOOKING"
  | "CONSULTATION_REFUND"
  | "TOKEN_TOPUP"
  | string;

export type TokenMetadata = Prisma.InputJsonValue;

type SignedAmount = {
  signedAmount: number;
  rawAmount: number;
  direction: LedgerDirection;
};

function computeSignedAmount(amount: number, direction: LedgerDirection): SignedAmount {
  if (amount <= 0) {
    throw new Error("Token amount must be a positive integer");
  }

  const sign = direction === "CREDIT" ? 1 : -1;
  return {
    signedAmount: amount * sign,
    rawAmount: amount,
    direction,
  };
}

// -----------------------------------------------------------------------------
// Effective cost / payout helper
// -----------------------------------------------------------------------------

export type EffectiveTokenValues = {
  effectiveCost: number;
  effectivePayout: number;
  isOverridden: boolean;
};

/**
 * Calculate the effective token cost and creative payout for a ticket,
 * accounting for quantity and admin overrides.
 */
export function getEffectiveTokenValues(ticket: {
  quantity: number;
  tokenCostOverride: number | null;
  creativePayoutOverride: number | null;
  jobType: { tokenCost: number; creativePayoutTokens: number } | null;
}): EffectiveTokenValues {
  if (!ticket.jobType) {
    return { effectiveCost: 0, effectivePayout: 0, isOverridden: false };
  }

  const baseCost = ticket.jobType.tokenCost * ticket.quantity;
  const basePayout = ticket.jobType.creativePayoutTokens * ticket.quantity;

  return {
    effectiveCost: ticket.tokenCostOverride ?? baseCost,
    effectivePayout: ticket.creativePayoutOverride ?? basePayout,
    isOverridden: ticket.tokenCostOverride != null || ticket.creativePayoutOverride != null,
  };
}

// -----------------------------------------------------------------------------
// Payout rule evaluation (gamification system)
// -----------------------------------------------------------------------------

export const BASE_PAYOUT_PERCENT = 60;

export type PayoutEvaluation = {
  payoutPercent: number;
  matchedRuleId: string | null;
  matchedRuleName: string | null;
};

/**
 * Evaluate which payout percentage a creative qualifies for.
 * Iterates active rules sorted by payoutPercent DESC; first match wins
 * (creative always gets the best rate they qualify for).
 */
export async function evaluateCreativePayoutPercent(
  creativeId: string,
  tx?: Prisma.TransactionClient,
): Promise<PayoutEvaluation> {
  const db = tx ?? prisma;

  const rules = await (db as any).payoutRule.findMany({
    where: { isActive: true },
    orderBy: { payoutPercent: "desc" },
  });

  if (rules.length === 0) {
    return {
      payoutPercent: BASE_PAYOUT_PERCENT,
      matchedRuleId: null,
      matchedRuleName: null,
    };
  }

  for (const rule of rules) {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - rule.timeWindowDays);

    const completedCount = await (db as any).ticket.count({
      where: {
        creativeId,
        status: "DONE",
        updatedAt: { gte: windowStart },
      },
    });

    if (completedCount >= rule.minCompletedTickets) {
      return {
        payoutPercent: rule.payoutPercent,
        matchedRuleId: rule.id,
        matchedRuleName: rule.name,
      };
    }
  }

  return {
    payoutPercent: BASE_PAYOUT_PERCENT,
    matchedRuleId: null,
    matchedRuleName: null,
  };
}

// -----------------------------------------------------------------------------
// Company-level tokens (customer balance)
// -----------------------------------------------------------------------------

export interface ApplyCompanyLedgerInput {
  companyId: string;
  ticketId?: string | null;
  amount: number; // always positive
  direction: LedgerDirection; // CREDIT or DEBIT
  reason?: TokenReason;
  notes?: string | null;
  metadata?: TokenMetadata;
}

/**
 * Updates the company's token balance and creates the corresponding TokenLedger entry.
 * - amount: positive integer
 * - direction: CREDIT => balance increases, DEBIT => balance decreases
 */
export async function applyCompanyLedgerEntry(input: ApplyCompanyLedgerInput) {
  const { companyId, ticketId, amount, direction, reason, notes, metadata } = input;

  const { signedAmount, rawAmount } = computeSignedAmount(amount, direction);

  return prisma.$transaction(async (tx) => {
    const company = await tx.company.findUnique({
      where: { id: companyId },
      select: { tokenBalance: true },
    });

    if (!company) {
      throw new Error(`Company not found for id=${companyId}`);
    }

    const balanceBefore = company.tokenBalance;
    const balanceAfter = balanceBefore + signedAmount;

    const ledger = await tx.tokenLedger.create({
      data: {
        companyId,
        ticketId: ticketId ?? null,
        direction,
        amount: rawAmount,
        reason: reason ?? null,
        notes: notes ?? null,
        metadata: metadata ?? undefined,
        balanceBefore,
        balanceAfter,
      },
    });

    await tx.company.update({
      where: { id: companyId },
      data: {
        tokenBalance: balanceAfter,
      },
    });

    return {
      ledger,
      balanceAfter,
    };
  });
}

/**
 * Safety / repair helper:
 * - Reads every ledger entry for the given company and computes the real balance.
 * - Sets Company.tokenBalance to that value.
 */
export async function recalculateCompanyTokenBalance(companyId: string) {
  return prisma.$transaction(async (tx) => {
    const credits = await tx.tokenLedger.aggregate({
      where: { companyId, direction: "CREDIT" },
      _sum: { amount: true },
    });

    const debits = await tx.tokenLedger.aggregate({
      where: { companyId, direction: "DEBIT" },
      _sum: { amount: true },
    });

    const creditSum = credits._sum.amount ?? 0;
    const debitSum = debits._sum.amount ?? 0;

    const realBalance = creditSum - debitSum;

    await tx.company.update({
      where: { id: companyId },
      data: {
        tokenBalance: realBalance,
      },
    });

    return realBalance;
  });
}

// -----------------------------------------------------------------------------
// User-level tokens (creative balance)
// -----------------------------------------------------------------------------

export interface ApplyUserLedgerInput {
  userId: string;
  companyId?: string | null; // optional: which company's job this was earned on
  ticketId?: string | null;
  amount: number;
  direction: LedgerDirection;
  reason?: TokenReason;
  notes?: string | null;
  metadata?: TokenMetadata;
}

/**
 * Create a token ledger entry for a creative (UserAccount).
 * UserAccount has no tokenBalance column, so balanceBefore / balanceAfter
 * are derived from the ledger aggregate.
 */
export async function applyUserLedgerEntry(input: ApplyUserLedgerInput) {
  const { userId, companyId, ticketId, amount, direction, reason, notes, metadata } = input;

  const { signedAmount, rawAmount } = computeSignedAmount(amount, direction);

  return prisma.$transaction(async (tx) => {
    // Per-user balance = CREDIT - DEBIT
    const creditAgg = await tx.tokenLedger.aggregate({
      where: { userId, direction: "CREDIT" },
      _sum: { amount: true },
    });

    const debitAgg = await tx.tokenLedger.aggregate({
      where: { userId, direction: "DEBIT" },
      _sum: { amount: true },
    });

    const creditSum = creditAgg._sum.amount ?? 0;
    const debitSum = debitAgg._sum.amount ?? 0;

    const balanceBefore = creditSum - debitSum;
    const balanceAfter = balanceBefore + signedAmount;

    const ledger = await tx.tokenLedger.create({
      data: {
        userId,
        companyId: companyId ?? null,
        ticketId: ticketId ?? null,
        direction,
        amount: rawAmount,
        reason: reason ?? null,
        notes: notes ?? null,
        metadata: metadata ?? undefined,
        balanceBefore,
        balanceAfter,
      },
    });

    return {
      ledger,
      balanceAfter,
    };
  });
}

/**
 * Computes the creative's token balance from their ledger.
 * Useful for answering "how many tokens can they withdraw?" before a withdrawal request.
 */
export async function getUserTokenBalance(userId: string) {
  const [credits, debits] = await Promise.all([
    prisma.tokenLedger.aggregate({
      where: { userId, direction: "CREDIT" },
      _sum: { amount: true },
    }),
    prisma.tokenLedger.aggregate({
      where: { userId, direction: "DEBIT" },
      _sum: { amount: true },
    }),
  ]);

  const creditSum = credits._sum.amount ?? 0;
  const debitSum = debits._sum.amount ?? 0;

  return creditSum - debitSum;
}

// -----------------------------------------------------------------------------
// Ticket completion flow (ticket DONE + token movements)
// -----------------------------------------------------------------------------

export interface TicketCompletionResult {
  ticket: {
    id: string;
    status: TicketStatus;
    companyId: string;
    creativeId: string | null;
    jobTypeId: string | null;
  };
  companyLedgerEntry: Prisma.TokenLedgerGetPayload<{ select: { id: true } }> | null;
  creativeLedgerEntry: Prisma.TokenLedgerGetPayload<{ select: { id: true } }> | null;
  companyBalanceAfter: number | null;
  creativeBalanceAfter: number | null;
  alreadyCompleted: boolean;
}

/**
 * When a ticket is marked complete:
 * - Ticket.status => DONE
 * - DEBIT jobType.tokenCost from the company
 * - CREDIT jobType.creativePayoutTokens to the creative
 *
 * Idempotent:
 * - If the ticket is already DONE, or a ledger entry with reason = "JOB_PAYMENT" already
 *   exists for this ticket, returns "alreadyCompleted = true" without creating new entries.
 */
export async function completeTicketAndApplyTokens(
  ticketId: string,
): Promise<TicketCompletionResult> {
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({
      where: { id: ticketId },
      include: {
        jobType: true,
      },
    });

    if (!ticket) {
      throw new Error(`Ticket not found for id=${ticketId}`);
    }

    if (!ticket.companyId) {
      throw new Error(`Ticket ${ticketId} has no companyId. Cannot apply company tokens.`);
    }

    if (!ticket.jobType) {
      throw new Error(`Ticket ${ticketId} has no jobType. Token costs are not defined.`);
    }

    // Idempotency guard: already DONE, or a JOB_PAYMENT ledger exists for this ticket.
    const existingPayment = await tx.tokenLedger.findFirst({
      where: {
        ticketId: ticket.id,
        reason: "JOB_PAYMENT",
      },
    });

    if (ticket.status === TicketStatus.DONE || existingPayment) {
      const finalTicket =
        ticket.status === TicketStatus.DONE
          ? ticket
          : await tx.ticket.update({
              where: { id: ticket.id },
              data: { status: TicketStatus.DONE },
            });

      return {
        ticket: {
          id: finalTicket.id,
          status: finalTicket.status,
          companyId: finalTicket.companyId,
          creativeId: finalTicket.creativeId,
          jobTypeId: finalTicket.jobTypeId,
        },
        companyLedgerEntry: null,
        creativeLedgerEntry: null,
        companyBalanceAfter: null,
        creativeBalanceAfter: null,
        alreadyCompleted: true,
      };
    }

    // Effective payout: override > gamification rule > base
    let effectivePayout: number;
    let appliedPayoutPercent: number = BASE_PAYOUT_PERCENT;
    let matchedRuleId: string | null = null;
    let matchedRuleName: string | null = null;

    if (ticket.creativePayoutOverride != null) {
      effectivePayout = ticket.creativePayoutOverride;
    } else if (ticket.creativeId) {
      const ruleResult = await evaluateCreativePayoutPercent(ticket.creativeId, tx);
      appliedPayoutPercent = ruleResult.payoutPercent;
      matchedRuleId = ruleResult.matchedRuleId;
      matchedRuleName = ruleResult.matchedRuleName;
      effectivePayout = Math.round(
        ticket.jobType.tokenCost * (ticket.quantity ?? 1) * (appliedPayoutPercent / 100),
      );
    } else {
      effectivePayout = ticket.jobType.creativePayoutTokens * (ticket.quantity ?? 1);
    }

    // Company is NOT debited here — the company was already charged at ticket
    // creation time (reason: "JOB_REQUEST_CREATED"). Completion only credits
    // the creative.
    const companyLedgerEntry = null;
    const companyBalanceAfter = null;

    // --- Creative side (CREDIT) ---
    let creativeLedgerEntry: { id: string } | null = null;
    let creativeBalanceAfter: number | null = null;

    if (ticket.creativeId && effectivePayout > 0) {
      const [credits, debits] = await Promise.all([
        tx.tokenLedger.aggregate({
          where: { userId: ticket.creativeId, direction: "CREDIT" },
          _sum: { amount: true },
        }),
        tx.tokenLedger.aggregate({
          where: { userId: ticket.creativeId, direction: "DEBIT" },
          _sum: { amount: true },
        }),
      ]);

      const creativeCreditSum = credits._sum.amount ?? 0;
      const creativeDebitSum = debits._sum.amount ?? 0;

      const creativeBalanceBefore = creativeCreditSum - creativeDebitSum;
      creativeBalanceAfter = creativeBalanceBefore + effectivePayout;

      creativeLedgerEntry = await tx.tokenLedger.create({
        data: {
          userId: ticket.creativeId,
          companyId: ticket.companyId,
          ticketId: ticket.id,
          direction: "CREDIT",
          amount: effectivePayout,
          reason: "JOB_PAYMENT",
          // Legacy note: reason kept as "DESIGNER_JOB_PAYOUT" would break existing data
          notes: `Creative payout for ticket ${ticket.id}`,
          metadata: {
            ...(ticket.jobTypeId ? { jobTypeId: ticket.jobTypeId } : {}),
            tokenCost: ticket.jobType.tokenCost,
            quantity: ticket.quantity ?? 1,
            appliedPayoutPercent,
            ...(matchedRuleId
              ? { payoutRuleId: matchedRuleId, payoutRuleName: matchedRuleName }
              : {}),
            ...(ticket.creativePayoutOverride != null
              ? { overridden: true, override: ticket.creativePayoutOverride }
              : {}),
          },
          balanceBefore: creativeBalanceBefore,
          balanceAfter: creativeBalanceAfter,
        },
        select: {
          id: true,
        },
      });
    }

    const updatedTicket = await tx.ticket.update({
      where: { id: ticket.id },
      data: {
        status: TicketStatus.DONE,
      },
      select: {
        id: true,
        status: true,
        companyId: true,
        creativeId: true,
        jobTypeId: true,
      },
    });

    return {
      ticket: updatedTicket,
      companyLedgerEntry,
      creativeLedgerEntry,
      companyBalanceAfter,
      creativeBalanceAfter,
      alreadyCompleted: false,
    };
  });
}
