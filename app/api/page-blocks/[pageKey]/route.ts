// -----------------------------------------------------------------------------
// @file: app/api/page-blocks/[pageKey]/route.ts
// @purpose: Public, unauthenticated endpoint that returns the ordered list
//           of PageBlocks for a given pageKey, used by the landing page
//           and other public surfaces to render block-driven sections
//           client-side.
//
//           No sensitive data — same content a visitor would see by
//           rendering the page server-side. Cache-Control matches the
//           pattern used by /api/plans (60s edge with stale-while-
//           revalidate 5min) so admin saves propagate within a minute
//           and the DB isn't hit on every page load.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { getPageBlocks } from "@/lib/blocks/get-page-blocks";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ pageKey: string }> }) {
  try {
    const { pageKey } = await params;
    if (!pageKey || pageKey.length > 60 || !/^[a-z0-9-]+$/.test(pageKey)) {
      return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
    }

    const blocks = await getPageBlocks(pageKey);

    return NextResponse.json(
      { blocks },
      {
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (err) {
    console.error("[api/page-blocks/[pageKey]] failed", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
