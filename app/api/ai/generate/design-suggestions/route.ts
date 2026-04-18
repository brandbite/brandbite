// -----------------------------------------------------------------------------
// @file: app/api/ai/generate/design-suggestions/route.ts
// @purpose: AI design suggestions endpoint
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getAiToolConfig,
  validateSufficientTokens,
  claimAiGeneration,
  refundAiTokens,
  checkRateLimit,
} from "@/lib/ai/cost-calculator";
import { getDesignSuggestions } from "@/lib/ai/provider-router";
import { buildSuggestionPrompt } from "@/lib/ai/prompts";
import { readIdempotencyKey } from "@/lib/ai/idempotency";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "No active company" }, { status: 400 });
    }

    const idempotencyKey = readIdempotencyKey(req.headers);

    const body = await req.json();
    const { brief, includeColors, includeFonts, includeLayout } = body as {
      brief?: string;
      includeColors?: boolean;
      includeFonts?: boolean;
      includeLayout?: boolean;
    };

    if (!brief || brief.trim().length === 0) {
      return NextResponse.json({ error: "Brief is required" }, { status: 400 });
    }

    // Check tool is enabled
    const toolConfig = await getAiToolConfig("DESIGN_SUGGESTION");
    if (!toolConfig.enabled) {
      return NextResponse.json(
        { error: "Design suggestions are currently disabled" },
        { status: 403 },
      );
    }

    // Rate limit check
    const rateLimit = await checkRateLimit(user.activeCompanyId, "DESIGN_SUGGESTION");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          remaining: rateLimit.remaining,
          resetAt: rateLimit.resetAt.toISOString(),
        },
        { status: 429 },
      );
    }

    // Token balance check
    const cost = toolConfig.tokenCost;
    const balance = await validateSufficientTokens(user.activeCompanyId, cost);
    if (!balance.sufficient) {
      return NextResponse.json(
        {
          error: "Insufficient token balance",
          required: cost,
          balance: balance.balance,
        },
        { status: 402 },
      );
    }

    // Create AiGeneration record + debit tokens atomically. A retry with the
    // same Idempotency-Key returns the existing record instead of debiting again.
    const fullPrompt = buildSuggestionPrompt(brief);
    const { generation, reused } = await claimAiGeneration({
      idempotencyKey,
      userId: user.id,
      companyId: user.activeCompanyId,
      toolType: "DESIGN_SUGGESTION",
      prompt: fullPrompt,
      inputParams: { includeColors, includeFonts, includeLayout },
      cost,
    });

    if (reused) {
      const prior = (generation.outputParams ?? null) as {
        colors?: unknown;
        fonts?: unknown;
        layoutTips?: unknown;
        overallDirection?: unknown;
      } | null;
      return NextResponse.json(
        {
          generation: {
            id: generation.id,
            status: generation.status,
            toolType: generation.toolType,
            provider: generation.provider,
            model: generation.model,
            suggestions: prior
              ? {
                  colors: prior.colors,
                  fonts: prior.fonts,
                  layoutTips: prior.layoutTips,
                  overallDirection: prior.overallDirection,
                }
              : null,
            tokenCost: generation.tokenCost,
            createdAt: generation.createdAt.toISOString(),
          },
          reused: true,
        },
        { status: 200 },
      );
    }

    // Get design suggestions
    try {
      await prisma.aiGeneration.update({
        where: { id: generation.id },
        data: { status: "PROCESSING", startedAt: new Date() },
      });

      const result = await getDesignSuggestions(fullPrompt, {
        includeColors: includeColors ?? true,
        includeFonts: includeFonts ?? true,
        includeLayout: includeLayout ?? true,
      });

      // Update generation with result
      const completed = await prisma.aiGeneration.update({
        where: { id: generation.id },
        data: {
          status: "COMPLETED",
          provider: result.provider,
          model: result.model,
          outputText: result.overallDirection,
          outputParams: {
            colors: result.colors,
            fonts: result.fonts,
            layoutTips: result.layoutTips,
            overallDirection: result.overallDirection,
          },
          completedAt: new Date(),
        },
      });

      return NextResponse.json(
        {
          generation: {
            id: completed.id,
            status: completed.status,
            toolType: completed.toolType,
            provider: completed.provider,
            model: completed.model,
            suggestions: {
              colors: result.colors,
              fonts: result.fonts,
              layoutTips: result.layoutTips,
              overallDirection: result.overallDirection,
            },
            tokenCost: cost,
            createdAt: completed.createdAt.toISOString(),
          },
        },
        { status: 201 },
      );
    } catch (genError) {
      await prisma.aiGeneration.update({
        where: { id: generation.id },
        data: {
          status: "FAILED",
          errorMessage: genError instanceof Error ? genError.message : "Unknown error",
          completedAt: new Date(),
        },
      });

      await refundAiTokens(user.activeCompanyId, cost, {
        generationId: generation.id,
        toolType: "DESIGN_SUGGESTION",
      });

      console.error("[api/ai/generate/design-suggestions] generation failed", genError);
      return NextResponse.json(
        {
          error: "Design suggestion generation failed. Tokens have been refunded.",
        },
        { status: 500 },
      );
    }
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    if (code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if (code === "INVALID_IDEMPOTENCY_KEY") {
      return NextResponse.json(
        { error: "Idempotency-Key header must be a valid UUID" },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message === "IDEMPOTENCY_KEY_CONFLICT") {
      return NextResponse.json(
        { error: "Idempotency-Key belongs to another user or company" },
        { status: 409 },
      );
    }
    console.error("[api/ai/generate/design-suggestions] POST error", error);
    return NextResponse.json({ error: "Failed to get design suggestions" }, { status: 500 });
  }
}
