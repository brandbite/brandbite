// -----------------------------------------------------------------------------
// @file: app/api/color-meanings/[slug]/route.ts
// @purpose: Public read of one PUBLISHED color meaning by slug (encyclopedia
//           detail page). 404 when missing/unpublished. Mirrors /api/showcase/[slug].
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;

    const meaning = await prisma.colorMeaning.findFirst({
      where: { slug, status: "PUBLISHED" },
    });

    if (!meaning) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({
      meaning: {
        ...meaning,
        samplePalettes: Array.isArray(meaning.samplePalettes)
          ? (meaning.samplePalettes as string[][])
          : [],
      },
    });
  } catch (err) {
    console.error("[color-meanings/:slug] GET error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
