// -----------------------------------------------------------------------------
// @file: app/api/designer/payout-tier/route.ts
// @purpose: Designer API — current payout tier and progress toward each rule
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-25
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { BASE_PAYOUT_PERCENT, evaluateDesignerPayoutPercent } from "@/lib/token-engine";

export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "DESIGNER") {
      return NextResponse.json(
        { error: "Only designers can access payout tier info" },
        { status: 403 },
      );
    }

    // Get current tier
    const evaluation = await evaluateDesignerPayoutPercent(user.id);

    // Get all active rules with progress
    const rules = await prisma.payoutRule.findMany({
      where: { isActive: true },
      orderBy: { payoutPercent: "asc" },
    });

    const tiers = await Promise.all(
      rules.map(async (rule) => {
        const windowStart = new Date();
        windowStart.setDate(windowStart.getDate() - rule.timeWindowDays);

        const completedInWindow = await prisma.ticket.count({
          where: {
            designerId: user.id,
            status: "DONE",
            updatedAt: { gte: windowStart },
          },
        });

        return {
          id: rule.id,
          name: rule.name,
          description: rule.description,
          minCompletedTickets: rule.minCompletedTickets,
          timeWindowDays: rule.timeWindowDays,
          payoutPercent: rule.payoutPercent,
          completedInWindow,
          qualified: completedInWindow >= rule.minCompletedTickets,
        };
      }),
    );

    return NextResponse.json({
      currentPayoutPercent: evaluation.payoutPercent,
      currentTierName: evaluation.matchedRuleName,
      basePayoutPercent: BASE_PAYOUT_PERCENT,
      tiers,
    });
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[designer.payout-tier] GET error", error);
    return NextResponse.json({ error: "Failed to load payout tier" }, { status: 500 });
  }
}
