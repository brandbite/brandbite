// -----------------------------------------------------------------------------
// @file: lib/token-engine.ts
// @purpose: Token accounting helpers for Brandbite (companies, designers, tickets)
// @version: v1.3.0
// @lastUpdate: 2025-12-26
// -----------------------------------------------------------------------------

import {
  LedgerDirection,
  Prisma,
  TicketStatus,
} from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Token hareketleri için daha okunabilir reason kodları.
 */
export type TokenReason =
  | "PLAN_PURCHASE"
  | "PLAN_RENEWAL"
  | "JOB_PAYMENT"
  | "WITHDRAW"
  | "ADMIN_ADJUSTMENT"
  | "REFUND"
  | string;

export type TokenMetadata = Prisma.InputJsonValue;

type SignedAmount = {
  signedAmount: number;
  rawAmount: number;
  direction: LedgerDirection;
};

function computeSignedAmount(
  amount: number,
  direction: LedgerDirection
): SignedAmount {
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
 * Calculate the effective token cost and designer payout for a ticket,
 * accounting for quantity and admin overrides.
 */
export function getEffectiveTokenValues(ticket: {
  quantity: number;
  tokenCostOverride: number | null;
  designerPayoutOverride: number | null;
  jobType: { tokenCost: number; designerPayoutTokens: number } | null;
}): EffectiveTokenValues {
  if (!ticket.jobType) {
    return { effectiveCost: 0, effectivePayout: 0, isOverridden: false };
  }

  const baseCost = ticket.jobType.tokenCost * ticket.quantity;
  const basePayout = ticket.jobType.designerPayoutTokens * ticket.quantity;

  return {
    effectiveCost: ticket.tokenCostOverride ?? baseCost,
    effectivePayout: ticket.designerPayoutOverride ?? basePayout,
    isOverridden:
      ticket.tokenCostOverride != null ||
      ticket.designerPayoutOverride != null,
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
 * Evaluate which payout percentage a designer qualifies for.
 * Iterates active rules sorted by payoutPercent DESC; first match wins
 * (designer always gets the best rate they qualify for).
 */
export async function evaluateDesignerPayoutPercent(
  designerId: string,
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
        designerId,
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
// Company-level tokens (müşteri bakiyesi)
// -----------------------------------------------------------------------------

export interface ApplyCompanyLedgerInput {
  companyId: string;
  ticketId?: string | null;
  amount: number; // her zaman pozitif
  direction: LedgerDirection; // CREDIT veya DEBIT
  reason?: TokenReason;
  notes?: string | null;
  metadata?: TokenMetadata;
}

/**
 * Şirketin (company) token bakiyesini günceller ve ilgili TokenLedger kaydını oluşturur.
 * - amount: pozitif integer
 * - direction: CREDIT => bakiye artar, DEBIT => bakiye azalır
 */
export async function applyCompanyLedgerEntry(
  input: ApplyCompanyLedgerInput
) {
  const { companyId, ticketId, amount, direction, reason, notes, metadata } =
    input;

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
 * Güvenlik/repair fonksiyonu:
 * - Verilen şirket için tüm ledger kayıtlarını okuyup gerçek bakiyeyi hesaplar.
 * - Company.tokenBalance alanını bu değere set eder.
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
// User-level tokens (designer bakiyesi)
// -----------------------------------------------------------------------------

export interface ApplyUserLedgerInput {
  userId: string;
  companyId?: string | null; // opsiyonel: hangi company job'ı üzerinden kazanıldı
  ticketId?: string | null;
  amount: number;
  direction: LedgerDirection;
  reason?: TokenReason;
  notes?: string | null;
  metadata?: TokenMetadata;
}

/**
 * Designer (UserAccount) için token ledger kaydı oluşturur.
 * Şu an için UserAccount üzerinde ayrı bir tokenBalance alanımız yok;
 * bu yüzden balanceBefore / balanceAfter değerlerini ledger üzerinden hesaplıyoruz.
 */
export async function applyUserLedgerEntry(input: ApplyUserLedgerInput) {
  const {
    userId,
    companyId,
    ticketId,
    amount,
    direction,
    reason,
    notes,
    metadata,
  } = input;

  const { signedAmount, rawAmount } = computeSignedAmount(amount, direction);

  return prisma.$transaction(async (tx) => {
    // Kullanıcı bazlı mevcut bakiye: CREDIT - DEBIT
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
 * Mevcut user ledger'ına göre designer token bakiyesini hesaplar.
 * Bu fonksiyon, örneğin withdraw talebi öncesi "ne kadar token çekebilir?" sorusuna
 * cevap olmak için kullanılabilir.
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
// Ticket completion flow (ticket DONE + token hareketleri)
// -----------------------------------------------------------------------------

export interface TicketCompletionResult {
  ticket: {
    id: string;
    status: TicketStatus;
    companyId: string;
    designerId: string | null;
    jobTypeId: string | null;
  };
  companyLedgerEntry: Prisma.TokenLedgerGetPayload<{ select: { id: true } }> | null;
  designerLedgerEntry: Prisma.TokenLedgerGetPayload<{ select: { id: true } }> | null;
  companyBalanceAfter: number | null;
  designerBalanceAfter: number | null;
  alreadyCompleted: boolean;
}

/**
 * Ticket tamamlandığında:
 * - Ticket.status => DONE
 * - Company'den jobType.tokenCost kadar DEBIT
 * - Designer'a jobType.designerPayoutTokens kadar CREDIT
 *
 * İdempotent yaklaşım:
 * - Ticket zaten DONE ise veya bu ticket için reason = "JOB_PAYMENT" ledger kaydı varsa,
 *   "alreadyCompleted = true" ile döner ve yeni hareket yaratmaz.
 */
export async function completeTicketAndApplyTokens(
  ticketId: string
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
      throw new Error(
        `Ticket ${ticketId} has no companyId. Cannot apply company tokens.`
      );
    }

    if (!ticket.jobType) {
      throw new Error(
        `Ticket ${ticketId} has no jobType. Token costs are not defined.`
      );
    }

    // Eğer zaten DONE ise veya JOB_PAYMENT ledger'ı varsa idempotent kabul edelim
    const existingPayment = await tx.tokenLedger.findFirst({
      where: {
        ticketId: ticket.id,
        reason: "JOB_PAYMENT",
      },
    });

    if (ticket.status === TicketStatus.DONE || existingPayment) {
      const finalTicket = ticket.status === TicketStatus.DONE
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
          designerId: finalTicket.designerId,
          jobTypeId: finalTicket.jobTypeId,
        },
        companyLedgerEntry: null,
        designerLedgerEntry: null,
        companyBalanceAfter: null,
        designerBalanceAfter: null,
        alreadyCompleted: true,
      };
    }

    // Effective payout: override > gamification rule > base
    let effectivePayout: number;
    let appliedPayoutPercent: number = BASE_PAYOUT_PERCENT;
    let matchedRuleId: string | null = null;
    let matchedRuleName: string | null = null;

    if (ticket.designerPayoutOverride != null) {
      effectivePayout = ticket.designerPayoutOverride;
    } else if (ticket.designerId) {
      const ruleResult = await evaluateDesignerPayoutPercent(
        ticket.designerId,
        tx,
      );
      appliedPayoutPercent = ruleResult.payoutPercent;
      matchedRuleId = ruleResult.matchedRuleId;
      matchedRuleName = ruleResult.matchedRuleName;
      effectivePayout = Math.round(
        ticket.jobType.tokenCost *
          (ticket.quantity ?? 1) *
          (appliedPayoutPercent / 100),
      );
    } else {
      effectivePayout =
        ticket.jobType.designerPayoutTokens * (ticket.quantity ?? 1);
    }

    // Company is NOT debited here — the company was already charged at ticket
    // creation time (reason: "JOB_REQUEST_CREATED"). Completion only credits
    // the designer.
    const companyLedgerEntry = null;
    const companyBalanceAfter = null;

    // --- Designer tarafı (CREDIT) ---
    let designerLedgerEntry: { id: string } | null = null;
    let designerBalanceAfter: number | null = null;

    if (ticket.designerId && effectivePayout > 0) {
      const [credits, debits] = await Promise.all([
        tx.tokenLedger.aggregate({
          where: { userId: ticket.designerId, direction: "CREDIT" },
          _sum: { amount: true },
        }),
        tx.tokenLedger.aggregate({
          where: { userId: ticket.designerId, direction: "DEBIT" },
          _sum: { amount: true },
        }),
      ]);

      const designerCreditSum = credits._sum.amount ?? 0;
      const designerDebitSum = debits._sum.amount ?? 0;

      const designerBalanceBefore = designerCreditSum - designerDebitSum;
      designerBalanceAfter = designerBalanceBefore + effectivePayout;

      designerLedgerEntry = await tx.tokenLedger.create({
        data: {
          userId: ticket.designerId,
          companyId: ticket.companyId,
          ticketId: ticket.id,
          direction: "CREDIT",
          amount: effectivePayout,
          reason: "JOB_PAYMENT",
          notes: `Designer payout for ticket ${ticket.id}`,
          metadata: {
            ...(ticket.jobTypeId ? { jobTypeId: ticket.jobTypeId } : {}),
            tokenCost: ticket.jobType.tokenCost,
            quantity: ticket.quantity ?? 1,
            appliedPayoutPercent,
            ...(matchedRuleId
              ? { payoutRuleId: matchedRuleId, payoutRuleName: matchedRuleName }
              : {}),
            ...(ticket.designerPayoutOverride != null
              ? { overridden: true, override: ticket.designerPayoutOverride }
              : {}),
          },
          balanceBefore: designerBalanceBefore,
          balanceAfter: designerBalanceAfter,
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
        designerId: true,
        jobTypeId: true,
      },
    });

    return {
      ticket: updatedTicket,
      companyLedgerEntry,
      designerLedgerEntry,
      companyBalanceAfter,
      designerBalanceAfter,
      alreadyCompleted: false,
    };
  });
}