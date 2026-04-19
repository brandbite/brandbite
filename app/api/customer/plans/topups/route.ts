// -----------------------------------------------------------------------------
// @file: app/api/customer/plans/topups/route.ts
// @purpose: Customer-facing list of one-time token "top-up" packs. Used by
//           /customer/settings to render "Need more tokens now?" cards. Any
//           authenticated customer can read; purchase still goes through
//           /api/billing/checkout (OWNER/BILLING only, same as subscriptions).
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await getCurrentUserOrThrow();

    const topups = await prisma.plan.findMany({
      where: {
        isActive: true,
        isRecurring: false,
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

    return NextResponse.json({ topups });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[customer/plans/topups] GET error", error);
    return NextResponse.json({ error: "Failed to load top-up packs" }, { status: 500 });
  }
}
