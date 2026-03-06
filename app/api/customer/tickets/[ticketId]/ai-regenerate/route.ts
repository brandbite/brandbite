// -----------------------------------------------------------------------------
// @file: app/api/customer/tickets/[ticketId]/ai-regenerate/route.ts
// @purpose: Regenerate AI content with customer feedback
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateImage } from "@/lib/ai/provider-router";
import { buildRefinementPrompt } from "@/lib/ai/prompts";
import { saveAiImageToR2 } from "@/lib/ai/asset-pipeline";
import {
  getAiToolConfig,
  validateSufficientTokens,
  debitAiTokens,
  refundAiTokens,
} from "@/lib/ai/cost-calculator";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  try {
    const user = await getCurrentUserOrThrow();
    const { ticketId } = await params;

    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customers can regenerate AI content" },
        { status: 403 },
      );
    }

    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "No active company" }, { status: 400 });
    }

    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        companyId: user.activeCompanyId,
        creativeMode: "AI",
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: "AI ticket not found" }, { status: 404 });
    }

    const body = await req.json();
    const { feedback, style, size } = body as {
      feedback?: string;
      style?: string;
      size?: string;
    };

    if (!feedback || feedback.trim().length === 0) {
      return NextResponse.json({ error: "Feedback is required for regeneration" }, { status: 400 });
    }

    // Get the last generation's prompt for refinement
    const lastGeneration = await prisma.aiGeneration.findFirst({
      where: { ticketId, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      select: { prompt: true },
    });

    const originalPrompt = lastGeneration?.prompt || ticket.title;
    const refinedPrompt = buildRefinementPrompt(originalPrompt, feedback);

    // Iteration costs 1 token
    const iterationCost = 1;
    const toolConfig = await getAiToolConfig("IMAGE_GENERATION");

    if (toolConfig.enabled === false) {
      return NextResponse.json(
        { error: "AI image generation is currently disabled" },
        { status: 403 },
      );
    }

    const balance = await validateSufficientTokens(user.activeCompanyId, iterationCost);
    if (!balance.sufficient) {
      return NextResponse.json(
        {
          error: "Insufficient token balance for iteration",
          required: iterationCost,
          balance: balance.balance,
        },
        { status: 402 },
      );
    }

    // Create AiGeneration record
    const generation = await prisma.aiGeneration.create({
      data: {
        toolType: "IMAGE_GENERATION",
        userId: user.id,
        companyId: user.activeCompanyId,
        ticketId,
        prompt: refinedPrompt,
        inputParams: { feedback, style, size, isIteration: true },
        provider: "",
        model: "",
        status: "PROCESSING",
        tokenCost: iterationCost,
        startedAt: new Date(),
      },
    });

    // Debit iteration cost
    await debitAiTokens(user.activeCompanyId, iterationCost, {
      generationId: generation.id,
      toolType: "IMAGE_GENERATION",
      ticketId,
    });

    try {
      const result = await generateImage(refinedPrompt, {
        size,
        style: style as "vivid" | "natural" | undefined,
      });

      const revisionCount = await prisma.ticketRevision.count({
        where: { ticketId },
      });

      const revision = await prisma.ticketRevision.create({
        data: {
          ticketId,
          version: revisionCount + 1,
          creativeMessage: `AI Revision v${revisionCount + 1}`,
          aiGenerationId: generation.id,
        },
      });

      const asset = await saveAiImageToR2({
        imageUrl: result.url,
        ticketId,
        revisionId: revision.id,
        userId: user.id,
        originalName: `ai-revision-v${revisionCount + 1}.png`,
      });

      await prisma.aiGeneration.update({
        where: { id: generation.id },
        data: {
          status: "COMPLETED",
          provider: result.provider,
          model: result.model,
          outputImageUrl: asset.url || result.url,
          outputParams: {
            revisedPrompt: result.revisedPrompt,
            assetId: asset.assetId,
            feedback,
          },
          completedAt: new Date(),
        },
      });

      return NextResponse.json(
        {
          generation: {
            id: generation.id,
            status: "COMPLETED",
            imageUrl: asset.url || result.url,
            revisedPrompt: result.revisedPrompt,
            provider: result.provider,
            model: result.model,
          },
          revision: {
            id: revision.id,
            version: revision.version,
          },
          asset: {
            id: asset.assetId,
            url: asset.url,
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

      await refundAiTokens(user.activeCompanyId, iterationCost, {
        generationId: generation.id,
        toolType: "IMAGE_GENERATION",
        ticketId,
      });

      console.error("[customer/tickets/ai-regenerate] generation failed", genError);
      return NextResponse.json(
        { error: "AI regeneration failed. Token refunded." },
        { status: 500 },
      );
    }
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[customer/tickets/ai-regenerate] POST error", error);
    return NextResponse.json({ error: "Failed to regenerate AI content" }, { status: 500 });
  }
}
