// -----------------------------------------------------------------------------
// @file: app/api/faq/route.ts
// @purpose: Public, unauthenticated endpoint that returns the active FAQ
//           entries from the central Faq table. Used by the public /faq
//           marketing page, the /customer/faq and /creative/faq dashboard
//           surfaces, and the landing-page FAQ block.
//
//           No sensitive data — all returned content is intended for
//           public consumption. Cache-Control matches /api/plans and
//           /api/page-blocks (60s edge with stale-while-revalidate 5min)
//           so admin saves propagate within a minute and the DB isn't
//           hit on every page load.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const rows = await prisma.faq.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { position: "asc" }],
      select: {
        id: true,
        question: true,
        answer: true,
        category: true,
      },
    });

    // Derive the unique category list from the data so the client doesn't
    // need to hardcode it. Order: first-occurrence-wins, which respects
    // the alphabetical ordering above and feels stable in the UI.
    const categories: string[] = [];
    for (const row of rows) {
      if (!categories.includes(row.category)) categories.push(row.category);
    }

    return NextResponse.json(
      { faqs: rows, categories },
      {
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (err) {
    console.error("[api/faq] failed", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
