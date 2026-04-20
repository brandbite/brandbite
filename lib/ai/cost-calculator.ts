// -----------------------------------------------------------------------------
// @file: lib/ai/cost-calculator.ts
// @purpose: Token cost management for AI operations
// -----------------------------------------------------------------------------

import type { AiGeneration, AiToolType, Prisma } from "@prisma/client";
import { LedgerDirection } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Default costs when no AiToolConfig exists
const DEFAULT_COSTS: Record<AiToolType, number> = {
  IMAGE_GENERATION: 2,
  BACKGROUND_REMOVAL: 1,
  TEXT_GENERATION: 1,
  DESIGN_SUGGESTION: 1,
  BRIEF_PARSING: 1,
  // Real-ESRGAN at 4x is the most expensive tool we offer; users should pay
  // roughly double an image gen because the output is meaningfully larger
  // and the Replicate run is longer.
  UPSCALE_IMAGE: 2,
};

const DEFAULT_RATE_LIMITS: Record<AiToolType, number> = {
  IMAGE_GENERATION: 20,
  BACKGROUND_REMOVAL: 30,
  TEXT_GENERATION: 50,
  DESIGN_SUGGESTION: 30,
  BRIEF_PARSING: 30,
  UPSCALE_IMAGE: 20,
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
// Idempotent claim: create an AiGeneration + debit tokens in one transaction,
// or return the existing record if the idempotency key has already been used.
// ---------------------------------------------------------------------------

export class IdempotencyKeyConflictError extends Error {
  constructor() {
    super("IDEMPOTENCY_KEY_CONFLICT");
    this.name = "IdempotencyKeyConflictError";
  }
}

export type ClaimAiGenerationArgs = {
  /** Client-supplied UUID. Pass null to opt out of idempotency (legacy behavior). */
  idempotencyKey: string | null;
  userId: string;
  companyId: string;
  toolType: AiToolType;
  prompt: string;
  inputParams: Prisma.InputJsonValue;
  cost: number;
  ticketId?: string;
};

export type ClaimAiGenerationResult = {
  generation: AiGeneration;
  /** true when an existing record was returned (no new debit). */
  reused: boolean;
};

function isIdempotencyKeyConflict(err: unknown): boolean {
  // Prisma P2002 = unique constraint failed. Target is the idempotencyKey field.
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  ) {
    const target = (err as { meta?: { target?: string[] | string } }).meta?.target;
    if (typeof target === "string") return target.includes("idempotencyKey");
    if (Array.isArray(target)) return target.includes("idempotencyKey");
  }
  return false;
}

/**
 * Create an AiGeneration + debit tokens atomically. If the given idempotency
 * key has already been used, returns the existing record without debiting.
 *
 * Concurrency: two requests racing on the same key will both attempt to
 * create; the loser hits the unique constraint and we re-fetch the winner's
 * record so the client still gets a coherent response with no double-debit.
 */
export async function claimAiGeneration(
  args: ClaimAiGenerationArgs,
): Promise<ClaimAiGenerationResult> {
  if (args.idempotencyKey) {
    const existing = await prisma.aiGeneration.findUnique({
      where: { idempotencyKey: args.idempotencyKey },
    });
    if (existing) {
      if (existing.companyId !== args.companyId || existing.userId !== args.userId) {
        throw new IdempotencyKeyConflictError();
      }
      return { generation: existing, reused: true };
    }
  }

  try {
    const generation = await prisma.$transaction(async (tx) => {
      const created = await tx.aiGeneration.create({
        data: {
          toolType: args.toolType,
          userId: args.userId,
          companyId: args.companyId,
          ticketId: args.ticketId ?? null,
          prompt: args.prompt,
          inputParams: args.inputParams,
          provider: "",
          model: "",
          status: "PENDING",
          tokenCost: args.cost,
          idempotencyKey: args.idempotencyKey,
        },
      });

      const company = await tx.company.findUniqueOrThrow({
        where: { id: args.companyId },
        select: { tokenBalance: true },
      });
      const balanceBefore = company.tokenBalance;
      const balanceAfter = balanceBefore - args.cost;

      await tx.company.update({
        where: { id: args.companyId },
        data: { tokenBalance: balanceAfter },
      });

      await tx.tokenLedger.create({
        data: {
          companyId: args.companyId,
          ticketId: args.ticketId ?? null,
          direction: LedgerDirection.DEBIT,
          amount: args.cost,
          reason: "AI_GENERATION",
          balanceBefore,
          balanceAfter,
          metadata: {
            aiGenerationId: created.id,
            toolType: args.toolType,
          },
        },
      });

      return created;
    });

    return { generation, reused: false };
  } catch (err) {
    if (args.idempotencyKey && isIdempotencyKeyConflict(err)) {
      const winner = await prisma.aiGeneration.findUnique({
        where: { idempotencyKey: args.idempotencyKey },
      });
      if (winner) {
        if (winner.companyId !== args.companyId || winner.userId !== args.userId) {
          throw new IdempotencyKeyConflictError();
        }
        return { generation: winner, reused: true };
      }
    }
    throw err;
  }
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
