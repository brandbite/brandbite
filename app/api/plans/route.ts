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
  /** Marketing copy for the landing-page card. Optional — landing page
   *  falls back to a generic placeholder when null. Edited via
   *  /admin/plans alongside the Stripe-driven price/tokens fields. */
  tagline: string | null;
  features: string[] | null;
  displayCtaLabel: string | null;
  displaySubtitle: string | null;
};

/**
 * Defensive coercion of the JSON `features` column. Prisma returns
 * `JsonValue` which can be anything; we only render an array of
 * strings, so anything else collapses to null and the renderer falls
 * back to its placeholder.
 */
function coerceFeatures(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const safe = raw.filter((v): v is string => typeof v === "string");
  return safe.length > 0 ? safe : null;
}

export async function GET() {
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true, isRecurring: true },
      // Display order primary, price ascending as tie-break (and as
      // historical fallback for plans that haven't been ordered yet).
      orderBy: [{ displayOrder: { sort: "asc", nulls: "last" } }, { priceCents: "asc" }],
      select: {
        id: true,
        name: true,
        priceCents: true,
        monthlyTokens: true,
        tagline: true,
        features: true,
        displayCtaLabel: true,
        displaySubtitle: true,
      },
    });

    const body: { plans: PublicPlan[] } = {
      plans: plans.map((p) => ({
        id: p.id,
        name: p.name,
        priceCents: p.priceCents,
        monthlyTokens: p.monthlyTokens,
        tagline: p.tagline,
        features: coerceFeatures(p.features),
        displayCtaLabel: p.displayCtaLabel,
        displaySubtitle: p.displaySubtitle,
      })),
    };

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
