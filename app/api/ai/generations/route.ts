// -----------------------------------------------------------------------------
// @file: app/api/ai/generations/route.ts
// @purpose: List user's AI generation history
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "No active company" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const toolType = searchParams.get("toolType");
    const status = searchParams.get("status");
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
    const offset = parseInt(searchParams.get("offset") ?? "0");

    const where: Record<string, unknown> = {
      userId: user.id,
      companyId: user.activeCompanyId,
    };

    if (toolType) {
      where.toolType = toolType;
    }
    if (status) {
      where.status = status;
    }

    const [generations, total] = await Promise.all([
      prisma.aiGeneration.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          toolType: true,
          status: true,
          provider: true,
          model: true,
          prompt: true,
          outputText: true,
          outputImageUrl: true,
          outputParams: true,
          tokenCost: true,
          errorMessage: true,
          createdAt: true,
          completedAt: true,
          ticketId: true,
        },
      }),
      prisma.aiGeneration.count({ where }),
    ]);

    return NextResponse.json({
      generations: generations.map((g) => ({
        ...g,
        createdAt: g.createdAt.toISOString(),
        completedAt: g.completedAt?.toISOString() ?? null,
      })),
      total,
      limit,
      offset,
    });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[api/ai/generations] GET error", error);
    return NextResponse.json({ error: "Failed to load generation history" }, { status: 500 });
  }
}
