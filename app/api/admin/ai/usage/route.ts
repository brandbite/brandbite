// -----------------------------------------------------------------------------
// @file: app/api/admin/ai/usage/route.ts
// @purpose: Admin AI usage analytics
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();
    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "Only site admins can access AI usage" }, { status: 403 });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalCount, last30Count, last7Count, failedCount, byToolType, totalTokens] =
      await Promise.all([
        prisma.aiGeneration.count(),
        prisma.aiGeneration.count({
          where: { createdAt: { gte: thirtyDaysAgo } },
        }),
        prisma.aiGeneration.count({
          where: { createdAt: { gte: sevenDaysAgo } },
        }),
        prisma.aiGeneration.count({
          where: { status: "FAILED" },
        }),
        prisma.aiGeneration.groupBy({
          by: ["toolType"],
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
        }),
        prisma.aiGeneration.aggregate({
          _sum: { tokenCost: true },
        }),
      ]);

    const failureRate = totalCount > 0 ? ((failedCount / totalCount) * 100).toFixed(1) : "0";

    return NextResponse.json({
      usage: {
        totalGenerations: totalCount,
        last30Days: last30Count,
        last7Days: last7Count,
        failedCount,
        failureRate: `${failureRate}%`,
        totalTokensConsumed: totalTokens._sum.tokenCost ?? 0,
        byToolType: byToolType.map((g) => ({
          toolType: g.toolType,
          count: g._count.id,
        })),
      },
    });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin/ai/usage] GET error", error);
    return NextResponse.json({ error: "Failed to load AI usage" }, { status: 500 });
  }
}
