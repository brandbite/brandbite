// -----------------------------------------------------------------------------
// @file: app/api/ai/generate/image/route.ts
// @purpose: Standalone AI image generation endpoint
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
import { brandContextFor } from "@/lib/brand/load-brand-context";
import { generateImage, isAiToolAvailable } from "@/lib/ai/provider-router";
import { aiGenerationImageUrl, saveAiGenerationImage } from "@/lib/ai/asset-pipeline";
import { aiToolUnavailableResponse } from "@/lib/ai/unavailable-response";
import { buildImagePrompt } from "@/lib/ai/prompts";
import { readIdempotencyKey } from "@/lib/ai/idempotency";
import { insufficientTokensResponse } from "@/lib/errors/insufficient-tokens";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "No active company" }, { status: 400 });
    }

    const idempotencyKey = readIdempotencyKey(req.headers);

    const body = await req.json();
    const { prompt, style, size, jobType, useBrand } = body as {
      prompt?: string;
      /** false leaves the brand guide out of the prompt. */
      useBrand?: boolean;
      style?: string;
      size?: string;
      jobType?: string;
    };

    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Check tool is enabled
    const toolConfig = await getAiToolConfig("IMAGE_GENERATION");
    if (!toolConfig.enabled) {
      return NextResponse.json(
        { error: "Image generation is currently disabled" },
        { status: 403 },
      );
    }

    // No provider key: say so before any tokens move.
    if (!isAiToolAvailable("IMAGE_GENERATION")) return aiToolUnavailableResponse();

    // Rate limit check
    const rateLimit = await checkRateLimit(user.activeCompanyId, "IMAGE_GENERATION");
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
      return insufficientTokensResponse({
        required: cost,
        balance: balance.balance,
        action: "AI image generation",
      });
    }

    // Create AiGeneration record + debit tokens atomically. A retry with the
    // same Idempotency-Key returns the existing record instead of debiting again.
    const brandContext = await brandContextFor(user.activeCompanyId, "image", { useBrand });
    const fullPrompt = buildImagePrompt(brandContext ? `${prompt}\n\n${brandContext}` : prompt, {
      jobType,
      style,
    });
    const { generation, reused } = await claimAiGeneration({
      idempotencyKey,
      userId: user.id,
      companyId: user.activeCompanyId,
      toolType: "IMAGE_GENERATION",
      prompt: fullPrompt,
      inputParams: { style, size, jobType },
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
            imageUrl: await aiGenerationImageUrl(generation),
            tokenCost: generation.tokenCost,
            createdAt: generation.createdAt.toISOString(),
          },
          reused: true,
        },
        { status: 200 },
      );
    }

    // Generate image
    try {
      await prisma.aiGeneration.update({
        where: { id: generation.id },
        data: { status: "PROCESSING", startedAt: new Date() },
      });

      const result = await generateImage(fullPrompt, { size });

      // The model hands back the file itself; keep it in our storage.
      const stored = await saveAiGenerationImage({
        bytes: result.bytes,
        contentType: result.contentType,
        companyId: user.activeCompanyId,
        generationId: generation.id,
      });

      // Update generation with result
      const completed = await prisma.aiGeneration.update({
        where: { id: generation.id },
        data: {
          status: "COMPLETED",
          provider: result.provider,
          model: result.model,
          outputImageUrl: stored.url,
          outputParams: { revisedPrompt: result.revisedPrompt, storageKey: stored.storageKey },
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
            imageUrl: stored.url,
            revisedPrompt: result.revisedPrompt,
            tokenCost: cost,
            createdAt: completed.createdAt.toISOString(),
          },
        },
        { status: 201 },
      );
    } catch (genError) {
      // Generation failed — refund tokens
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
        toolType: "IMAGE_GENERATION",
      });

      console.error("[api/ai/generate/image] generation failed", genError);
      return NextResponse.json(
        { error: "Image generation failed. Tokens have been refunded." },
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
    console.error("[api/ai/generate/image] POST error", error);
    return NextResponse.json({ error: "Failed to generate image" }, { status: 500 });
  }
}
