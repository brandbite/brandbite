// -----------------------------------------------------------------------------
// @file: app/api/ai/generate/upscale/route.ts
// @purpose: AI image upscaling endpoint (Replicate Real-ESRGAN, 2x/4x)
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-04-20
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
import { upscaleImage } from "@/lib/ai/provider-router";
import { readIdempotencyKey } from "@/lib/ai/idempotency";
import { insufficientTokensResponse } from "@/lib/errors/insufficient-tokens";

const ALLOWED_SCALES = [2, 4] as const;
type AllowedScale = (typeof ALLOWED_SCALES)[number];

function isAllowedScale(value: unknown): value is AllowedScale {
  return typeof value === "number" && (ALLOWED_SCALES as readonly number[]).includes(value);
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "No active company" }, { status: 400 });
    }

    const idempotencyKey = readIdempotencyKey(req.headers);

    const body = await req.json();
    const { imageUrl, scale, faceEnhance } = body as {
      imageUrl?: string;
      scale?: number;
      faceEnhance?: boolean;
    };

    if (!imageUrl || imageUrl.trim().length === 0) {
      return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
    }

    const chosenScale: AllowedScale = isAllowedScale(scale) ? scale : 4;

    // Check tool is enabled
    const toolConfig = await getAiToolConfig("UPSCALE_IMAGE");
    if (!toolConfig.enabled) {
      return NextResponse.json({ error: "Image upscaling is currently disabled" }, { status: 403 });
    }

    // Rate limit check
    const rateLimit = await checkRateLimit(user.activeCompanyId, "UPSCALE_IMAGE");
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
        action: "AI image upscaling",
      });
    }

    // Create AiGeneration record + debit tokens atomically. A retry with the
    // same Idempotency-Key returns the existing record instead of debiting
    // again.
    const { generation, reused } = await claimAiGeneration({
      idempotencyKey,
      userId: user.id,
      companyId: user.activeCompanyId,
      toolType: "UPSCALE_IMAGE",
      prompt: `Upscale ${chosenScale}x: ${imageUrl}`,
      inputParams: { imageUrl, scale: chosenScale, faceEnhance: Boolean(faceEnhance) },
      cost,
    });

    if (reused) {
      const priorScale =
        (generation.inputParams as { scale?: number } | null)?.scale ?? chosenScale;
      return NextResponse.json(
        {
          generation: {
            id: generation.id,
            status: generation.status,
            toolType: generation.toolType,
            provider: generation.provider,
            model: generation.model,
            imageUrl: generation.outputImageUrl,
            scale: priorScale,
            tokenCost: generation.tokenCost,
            createdAt: generation.createdAt.toISOString(),
          },
          reused: true,
        },
        { status: 200 },
      );
    }

    try {
      await prisma.aiGeneration.update({
        where: { id: generation.id },
        data: { status: "PROCESSING", startedAt: new Date() },
      });

      const result = await upscaleImage(imageUrl, {
        scale: chosenScale,
        faceEnhance: Boolean(faceEnhance),
      });

      const completed = await prisma.aiGeneration.update({
        where: { id: generation.id },
        data: {
          status: "COMPLETED",
          provider: result.provider,
          model: result.model,
          outputImageUrl: result.url,
          outputParams: {
            scale: result.scale,
            faceEnhance: Boolean(faceEnhance),
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
            imageUrl: result.url,
            scale: result.scale,
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
        toolType: "UPSCALE_IMAGE",
      });

      console.error("[api/ai/generate/upscale] generation failed", genError);
      return NextResponse.json(
        {
          error: "Image upscaling failed. Tokens have been refunded.",
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
    console.error("[api/ai/generate/upscale] POST error", error);
    return NextResponse.json({ error: "Failed to upscale image" }, { status: 500 });
  }
}
