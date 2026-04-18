// -----------------------------------------------------------------------------
// @file: app/api/ai/generate/background-removal/route.ts
// @purpose: AI background removal endpoint
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
import { removeBackground } from "@/lib/ai/provider-router";
import { readIdempotencyKey } from "@/lib/ai/idempotency";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "No active company" }, { status: 400 });
    }

    const idempotencyKey = readIdempotencyKey(req.headers);

    const body = await req.json();
    const { imageUrl } = body as { imageUrl?: string };

    if (!imageUrl || imageUrl.trim().length === 0) {
      return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
    }

    // Check tool is enabled
    const toolConfig = await getAiToolConfig("BACKGROUND_REMOVAL");
    if (!toolConfig.enabled) {
      return NextResponse.json(
        { error: "Background removal is currently disabled" },
        { status: 403 },
      );
    }

    // Rate limit check
    const rateLimit = await checkRateLimit(user.activeCompanyId, "BACKGROUND_REMOVAL");
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
    const { generation, reused } = await claimAiGeneration({
      idempotencyKey,
      userId: user.id,
      companyId: user.activeCompanyId,
      toolType: "BACKGROUND_REMOVAL",
      prompt: `Remove background from: ${imageUrl}`,
      inputParams: { imageUrl },
      cost,
    });

    if (reused) {
      return NextResponse.json(
        {
          generation: {
            id: generation.id,
            status: generation.status,
            toolType: generation.toolType,
            provider: generation.provider,
            model: generation.model,
            imageUrl: generation.outputImageUrl,
            tokenCost: generation.tokenCost,
            createdAt: generation.createdAt.toISOString(),
          },
          reused: true,
        },
        { status: 200 },
      );
    }

    // Remove background
    try {
      await prisma.aiGeneration.update({
        where: { id: generation.id },
        data: { status: "PROCESSING", startedAt: new Date() },
      });

      const result = await removeBackground(imageUrl);

      // Update generation with result
      const completed = await prisma.aiGeneration.update({
        where: { id: generation.id },
        data: {
          status: "COMPLETED",
          provider: result.provider,
          model: result.model,
          outputImageUrl: result.url,
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
            imageUrl: result.url,
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
        toolType: "BACKGROUND_REMOVAL",
      });

      console.error("[api/ai/generate/background-removal] generation failed", genError);
      return NextResponse.json(
        {
          error: "Background removal failed. Tokens have been refunded.",
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
    console.error("[api/ai/generate/background-removal] POST error", error);
    return NextResponse.json({ error: "Failed to remove background" }, { status: 500 });
  }
}
