// -----------------------------------------------------------------------------
// @file: lib/token-engine.ts
// @purpose: Token accounting helpers for Brandbite (companies & designers)
// @version: v1.1.0
// @lastUpdate: 2025-11-13
// -----------------------------------------------------------------------------

import { LedgerDirection, Prisma } from "@prisma/client";
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