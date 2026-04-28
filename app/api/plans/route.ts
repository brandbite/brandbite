// -----------------------------------------------------------------------------
// @file: app/api/plans/route.ts
// @purpose: Public endpoint that returns the active recurring plans for the
//           landing page + dedicated /pricing page to render. Source of
//           truth is the `Plan` table in our DB, which is itself kept in
//           sync with Stripe Prices via the webhook handler at
//           `app/api/billing/webhook/route.ts` (price.created /
//           product.updated branches).
//
//           Public, unauthenticated. The data is the same prices a visitor
//           would see by clicking through to checkout — no sensitive
//           fields exposed. Cached at the edge for 60 seconds with
//           stale-while-revalidate so a Stripe-driven price change shows
//           up within a minute without hammering the DB on every page
//           load.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type PublicPlan = {
  id: string;
  name: string;
  priceCents: number;
  monthlyTokens: number;
};

export async function GET() {
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true, isRecurring: true },
      orderBy: { priceCents: "asc" },
      select: {
        id: true,
        name: true,
        priceCents: true,
        monthlyTokens: true,
      },
    });

    const body: { plans: PublicPlan[] } = { plans };

    return NextResponse.json(body, {
      headers: {
        // Edge-cached for 1 min; serve stale up to 5 min while revalidating
        // in the background. Bumps in either direction (admin edit OR
        // Stripe webhook → Plan row update) appear within ~60s.
        "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    console.error("[api/plans] failed to load plans", err);
    return NextResponse.json({ error: "Failed to load plans" }, { status: 500 });
  }
}
