// -----------------------------------------------------------------------------
// @file: app/api/customer/plans/subscriptions/route.ts
// @purpose: Customer-facing list of active recurring plans (subscriptions)
//           so /customer/settings can render upgrade/downgrade cards.
//           Top-up packs are served separately via /api/customer/plans/topups.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await getCurrentUserOrThrow();

    const plans = await prisma.plan.findMany({
      where: {
        isActive: true,
        isRecurring: true,
        stripePriceId: { not: null },
      },
      select: {
        id: true,
        name: true,
        description: true,
        monthlyTokens: true,
        priceCents: true,
      },
      orderBy: { monthlyTokens: "asc" },
    });

    return NextResponse.json({ plans });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[customer/plans/subscriptions] GET error", error);
    return NextResponse.json({ error: "Failed to load plans" }, { status: 500 });
  }
}
