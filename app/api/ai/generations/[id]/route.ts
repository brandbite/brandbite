// -----------------------------------------------------------------------------
// @file: app/api/ai/generations/[id]/route.ts
// @purpose: Get a single AI generation by ID (for polling status)
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserOrThrow();
    const { id } = await params;

    const generation = await prisma.aiGeneration.findUnique({
      where: { id },
      select: {
        id: true,
        toolType: true,
        status: true,
        provider: true,
        model: true,
        prompt: true,
        inputParams: true,
        outputText: true,
        outputImageUrl: true,
        outputParams: true,
        tokenCost: true,
        errorMessage: true,
        retryCount: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        userId: true,
        companyId: true,
        ticketId: true,
      },
    });

    if (!generation) {
      return NextResponse.json({ error: "Generation not found" }, { status: 404 });
    }

    // Users can only see their own generations
    if (generation.userId !== user.id) {
      return NextResponse.json({ error: "Generation not found" }, { status: 404 });
    }

    return NextResponse.json({
      generation: {
        ...generation,
        startedAt: generation.startedAt?.toISOString() ?? null,
        completedAt: generation.completedAt?.toISOString() ?? null,
        createdAt: generation.createdAt.toISOString(),
      },
    });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[api/ai/generations/[id]] GET error", error);
    return NextResponse.json({ error: "Failed to load generation" }, { status: 500 });
  }
}
