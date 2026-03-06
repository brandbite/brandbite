// -----------------------------------------------------------------------------
// @file: app/api/customer/tickets/[ticketId]/ai-generate/route.ts
// @purpose: Trigger AI generation for an AI-mode ticket, creating a revision
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateImage } from "@/lib/ai/provider-router";
import { buildImagePrompt } from "@/lib/ai/prompts";
import { saveAiImageToR2 } from "@/lib/ai/asset-pipeline";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  try {
    const user = await getCurrentUserOrThrow();
    const { ticketId } = await params;

    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customers can trigger AI generation" },
        { status: 403 },
      );
    }

    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "No active company" }, { status: 400 });
    }

    // Verify ticket belongs to the customer's company and is AI mode
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        companyId: user.activeCompanyId,
        creativeMode: "AI",
      },
      include: {
        jobType: { select: { name: true } },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: "AI ticket not found" }, { status: 404 });
    }

    const body = await req.json();
    const { style, size } = body as {
      style?: string;
      size?: string;
    };

    // Build prompt from ticket title + description
    const prompt = buildImagePrompt(
      `${ticket.title}${ticket.description ? `. ${ticket.description}` : ""}`,
      { jobType: ticket.jobType?.name, style },
    );

    // Create AiGeneration record linked to ticket
    const generation = await prisma.aiGeneration.create({
      data: {
        toolType: "IMAGE_GENERATION",
        userId: user.id,
        companyId: user.activeCompanyId,
        ticketId,
        prompt,
        inputParams: { style, size },
        provider: "",
        model: "",
        status: "PROCESSING",
        tokenCost: 0, // Already paid at ticket creation
        startedAt: new Date(),
      },
    });

    try {
      const result = await generateImage(prompt, {
        size,
        style: style as "vivid" | "natural" | undefined,
      });

      // Create a new revision for the ticket
      const revisionCount = await prisma.ticketRevision.count({
        where: { ticketId },
      });

      const revision = await prisma.ticketRevision.create({
        data: {
          ticketId,
          version: revisionCount + 1,
          creativeMessage: `AI Generation v${revisionCount + 1}`,
          aiGenerationId: generation.id,
        },
      });

      // Save image to R2 and create asset
      const asset = await saveAiImageToR2({
        imageUrl: result.url,
        ticketId,
        revisionId: revision.id,
        userId: user.id,
        originalName: `ai-output-v${revisionCount + 1}.png`,
      });

      // Update generation with result
      await prisma.aiGeneration.update({
        where: { id: generation.id },
        data: {
          status: "COMPLETED",
          provider: result.provider,
          model: result.model,
          outputImageUrl: asset.url || result.url,
          outputParams: { revisedPrompt: result.revisedPrompt, assetId: asset.assetId },
          completedAt: new Date(),
        },
      });

      // Update ticket status to IN_REVIEW so customer can review the result
      await prisma.ticket.update({
        where: { id: ticketId },
        data: { status: "IN_REVIEW" },
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

      console.error("[customer/tickets/ai-generate] generation failed", genError);
      return NextResponse.json(
        { error: "AI generation failed. Please try again." },
        { status: 500 },
      );
    }
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[customer/tickets/ai-generate] POST error", error);
    return NextResponse.json({ error: "Failed to generate AI content" }, { status: 500 });
  }
}
