// -----------------------------------------------------------------------------
// @file: lib/ai/cost-calculator.ts
// @purpose: Token cost management for AI operations
// -----------------------------------------------------------------------------

import type { AiToolType } from "@prisma/client";
import { LedgerDirection } from "@prisma/client";
import { prisma } from "../prisma";

// Default costs when no AiToolConfig exists
const DEFAULT_COSTS: Record<AiToolType, number> = {
  IMAGE_GENERATION: 2,
  BACKGROUND_REMOVAL: 1,
  TEXT_GENERATION: 1,
  DESIGN_SUGGESTION: 1,
};

const DEFAULT_RATE_LIMITS: Record<AiToolType, number> = {
  IMAGE_GENERATION: 20,
  BACKGROUND_REMOVAL: 30,
  TEXT_GENERATION: 50,
  DESIGN_SUGGESTION: 30,
};

// ---------------------------------------------------------------------------
// Get tool config
// ---------------------------------------------------------------------------

export async function getAiToolConfig(toolType: AiToolType) {
  const config = await prisma.aiToolConfig.findUnique({
    where: { toolType },
  });

  return {
    enabled: config?.enabled ?? true,
    tokenCost: config?.tokenCost ?? DEFAULT_COSTS[toolType],
    rateLimit: config?.rateLimit ?? DEFAULT_RATE_LIMITS[toolType],
    config: config?.config as Record<string, unknown> | null,
  };
}

// ---------------------------------------------------------------------------
// Token balance check
// ---------------------------------------------------------------------------

export async function validateSufficientTokens(
  companyId: string,
  cost: number,
): Promise<{ sufficient: boolean; balance: number }> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { tokenBalance: true },
  });

  if (!company) {
    return { sufficient: false, balance: 0 };
  }

  return {
    sufficient: company.tokenBalance >= cost,
    balance: company.tokenBalance,
  };
}

// ---------------------------------------------------------------------------
// Token debit for AI operations
// ---------------------------------------------------------------------------

export async function debitAiTokens(
  companyId: string,
  cost: number,
  metadata: {
    generationId: string;
    toolType: AiToolType;
    ticketId?: string;
  },
): Promise<{ balanceAfter: number }> {
  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { tokenBalance: true },
    });

    const balanceBefore = company.tokenBalance;
    const balanceAfter = balanceBefore - cost;

    await tx.company.update({
      where: { id: companyId },
      data: { tokenBalance: balanceAfter },
    });

    await tx.tokenLedger.create({
      data: {
        companyId,
        ticketId: metadata.ticketId ?? null,
        direction: LedgerDirection.DEBIT,
        amount: cost,
        reason: "AI_GENERATION",
        balanceBefore,
        balanceAfter,
        metadata: {
          aiGenerationId: metadata.generationId,
          toolType: metadata.toolType,
        },
      },
    });

    return { balanceAfter };
  });

  return result;
}

// ---------------------------------------------------------------------------
// Token refund on failure
// ---------------------------------------------------------------------------

export async function refundAiTokens(
  companyId: string,
  cost: number,
  metadata: {
    generationId: string;
    toolType: AiToolType;
    ticketId?: string;
  },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const company = await tx.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { tokenBalance: true },
    });

    const balanceBefore = company.tokenBalance;
    const balanceAfter = balanceBefore + cost;

    await tx.company.update({
      where: { id: companyId },
      data: { tokenBalance: balanceAfter },
    });

    await tx.tokenLedger.create({
      data: {
        companyId,
        ticketId: metadata.ticketId ?? null,
        direction: LedgerDirection.CREDIT,
        amount: cost,
        reason: "AI_REFUND",
        balanceBefore,
        balanceAfter,
        metadata: {
          aiGenerationId: metadata.generationId,
          toolType: metadata.toolType,
        },
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

export async function checkRateLimit(
  companyId: string,
  toolType: AiToolType,
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const config = await getAiToolConfig(toolType);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const recentCount = await prisma.aiGeneration.count({
    where: {
      companyId,
      toolType,
      createdAt: { gte: oneHourAgo },
    },
  });

  const remaining = Math.max(0, config.rateLimit - recentCount);
  const resetAt = new Date(Date.now() + 60 * 60 * 1000);

  return {
    allowed: recentCount < config.rateLimit,
    remaining,
    resetAt,
  };
}
