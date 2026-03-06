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
  debitAiTokens,
  refundAiTokens,
  checkRateLimit,
} from "@/lib/ai/cost-calculator";
import { generateImage } from "@/lib/ai/provider-router";
import { buildImagePrompt } from "@/lib/ai/prompts";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "No active company" }, { status: 400 });
    }

    const body = await req.json();
    const { prompt, style, size, jobType, preferProvider } = body as {
      prompt?: string;
      style?: string;
      size?: string;
      jobType?: string;
      preferProvider?: "openai" | "replicate";
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
    const fullPrompt = buildImagePrompt(prompt, { jobType, style });
    const generation = await prisma.aiGeneration.create({
      data: {
        toolType: "IMAGE_GENERATION",
        userId: user.id,
        companyId: user.activeCompanyId,
        prompt: fullPrompt,
        inputParams: { style, size, jobType, preferProvider },
        provider: "",
        model: "",
        status: "PENDING",
        tokenCost: cost,
      },
    });

    // Debit tokens
    await debitAiTokens(user.activeCompanyId, cost, {
      generationId: generation.id,
      toolType: "IMAGE_GENERATION",
    });

    // Generate image
    try {
      await prisma.aiGeneration.update({
        where: { id: generation.id },
        data: { status: "PROCESSING", startedAt: new Date() },
      });

      const result = await generateImage(fullPrompt, {
        size,
        style: style as "vivid" | "natural" | undefined,
        preferProvider,
      });

      // Update generation with result
      const completed = await prisma.aiGeneration.update({
        where: { id: generation.id },
        data: {
          status: "COMPLETED",
          provider: result.provider,
          model: result.model,
          outputImageUrl: result.url,
          outputParams: { revisedPrompt: result.revisedPrompt },
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
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[api/ai/generate/image] POST error", error);
    return NextResponse.json({ error: "Failed to generate image" }, { status: 500 });
  }
}
