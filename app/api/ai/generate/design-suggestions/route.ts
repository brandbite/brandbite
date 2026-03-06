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
  debitAiTokens,
  refundAiTokens,
  checkRateLimit,
} from "@/lib/ai/cost-calculator";
import { getDesignSuggestions } from "@/lib/ai/provider-router";
import { buildSuggestionPrompt } from "@/lib/ai/prompts";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "No active company" }, { status: 400 });
    }

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

    // Create AiGeneration record
    const fullPrompt = buildSuggestionPrompt(brief);
    const generation = await prisma.aiGeneration.create({
      data: {
        toolType: "DESIGN_SUGGESTION",
        userId: user.id,
        companyId: user.activeCompanyId,
        prompt: fullPrompt,
        inputParams: { includeColors, includeFonts, includeLayout },
        provider: "",
        model: "",
        status: "PENDING",
        tokenCost: cost,
      },
    });

    // Debit tokens
    await debitAiTokens(user.activeCompanyId, cost, {
      generationId: generation.id,
      toolType: "DESIGN_SUGGESTION",
    });

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
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[api/ai/generate/design-suggestions] POST error", error);
    return NextResponse.json({ error: "Failed to get design suggestions" }, { status: 500 });
  }
}
