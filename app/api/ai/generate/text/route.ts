// -----------------------------------------------------------------------------
// @file: app/api/ai/generate/text/route.ts
// @purpose: Standalone AI text/copy generation endpoint
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
import { generateText } from "@/lib/ai/provider-router";
import {
  buildCopySystemPrompt,
  buildCopyPrompt,
  type CopyFormat,
  type CopyTone,
} from "@/lib/ai/prompts";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "No active company" }, { status: 400 });
    }

    const body = await req.json();
    const { prompt, format, tone, variations, wordCount } = body as {
      prompt?: string;
      format?: CopyFormat;
      tone?: CopyTone;
      variations?: number;
      wordCount?: number;
    };

    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Check tool is enabled
    const toolConfig = await getAiToolConfig("TEXT_GENERATION");
    if (!toolConfig.enabled) {
      return NextResponse.json({ error: "Text generation is currently disabled" }, { status: 403 });
    }

    // Rate limit check
    const rateLimit = await checkRateLimit(user.activeCompanyId, "TEXT_GENERATION");
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

    // Build prompts
    const copyFormat = format ?? "custom";
    const copyTone = tone ?? "professional";
    const numVariations = Math.min(variations ?? 3, 5);
    const systemPrompt = buildCopySystemPrompt(copyFormat, copyTone, numVariations);
    const userPrompt = buildCopyPrompt(prompt, { wordCount });

    // Create AiGeneration record
    const generation = await prisma.aiGeneration.create({
      data: {
        toolType: "TEXT_GENERATION",
        userId: user.id,
        companyId: user.activeCompanyId,
        prompt: userPrompt,
        inputParams: { format: copyFormat, tone: copyTone, variations: numVariations, wordCount },
        provider: "",
        model: "",
        status: "PENDING",
        tokenCost: cost,
      },
    });

    // Debit tokens
    await debitAiTokens(user.activeCompanyId, cost, {
      generationId: generation.id,
      toolType: "TEXT_GENERATION",
    });

    // Generate text
    try {
      await prisma.aiGeneration.update({
        where: { id: generation.id },
        data: { status: "PROCESSING", startedAt: new Date() },
      });

      const result = await generateText(userPrompt, systemPrompt, {
        maxTokens: 1024,
        temperature: 0.8,
      });

      // Parse variations from JSON array response
      let textVariations: string[] = [];
      try {
        const parsed = JSON.parse(result.text);
        if (Array.isArray(parsed)) {
          textVariations = parsed;
        } else {
          textVariations = [result.text];
        }
      } catch {
        textVariations = [result.text];
      }

      // Update generation with result
      const completed = await prisma.aiGeneration.update({
        where: { id: generation.id },
        data: {
          status: "COMPLETED",
          provider: result.provider,
          model: result.model,
          outputText: result.text,
          outputParams: {
            variations: textVariations,
            usage: result.usage,
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
            variations: textVariations,
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
        toolType: "TEXT_GENERATION",
      });

      console.error("[api/ai/generate/text] generation failed", genError);
      return NextResponse.json(
        { error: "Text generation failed. Tokens have been refunded." },
        { status: 500 },
      );
    }
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[api/ai/generate/text] POST error", error);
    return NextResponse.json({ error: "Failed to generate text" }, { status: 500 });
  }
}
