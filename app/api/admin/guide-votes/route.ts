// -----------------------------------------------------------------------------
// @file: app/api/admin/guide-votes/route.ts
// @purpose: Per-guide "Was this helpful?" totals for /admin/guide-votes. Totals
//           only: the response never says who answered.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSiteAdminRole, isSiteOwnerRole } from "@/lib/roles";
import { summarizeGuideVotes } from "@/lib/support/guide-votes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();
    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const groups = await prisma.guideVote.groupBy({
      by: ["audience", "slug", "helpful"],
      _count: { _all: true },
    });

    const rows = summarizeGuideVotes(
      groups.map((g) => ({
        audience: g.audience,
        slug: g.slug,
        helpful: g.helpful,
        count: g._count._all,
      })),
      { isSiteOwner: isSiteOwnerRole(user.role) },
    );

    return NextResponse.json({ rows });
  } catch (error) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin.guide-votes] GET error", error);
    return NextResponse.json({ error: "Failed to load guide ratings" }, { status: 500 });
  }
}
