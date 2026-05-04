// -----------------------------------------------------------------------------
// @file: app/api/talent/categories/route.ts
// @purpose: Public read-only feed of active JobTypeCategory rows for the
//           /talent application form's skills multi-select. Anonymous —
//           the same data is what the admin sees in the category manager,
//           minus inactive rows. Edge-cached for 5 min so admin edits
//           propagate quickly without per-request DB load.
//
//           Source-of-truth is the same table the admin manages at
//           /admin/job-type-categories; the form posts the IDs back and
//           the submission route cross-validates that they're still active.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
// Revalidate the response cache every 5 minutes. The form is rendered
// client-side (`useEffect` fetches on mount), so this primarily helps the
// edge cache absorb form-load traffic without spiking DB reads.
export const revalidate = 300;

type PublicCategory = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
};

export async function GET() {
  try {
    const categories = await prisma.jobTypeCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, sortOrder: true },
    });

    const body: { categories: PublicCategory[] } = { categories };

    return NextResponse.json(body, {
      headers: {
        // Same posture as /api/plans: short max-age + generous SWR so admin
        // edits surface within ~5 min and the public form load stays fast.
        "Cache-Control":
          "public, max-age=300, s-maxage=300, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("[api/talent/categories] failed to load categories", err);
    return NextResponse.json(
      { error: "Failed to load categories" },
      { status: 500 },
    );
  }
}
