// -----------------------------------------------------------------------------
// @file: app/api/palette-ideas/route.ts
// @purpose: Public read of PUBLISHED palette ideas for the /colors gallery.
//           No auth (mirrors /api/showcase); listed in proxy PUBLIC_PATHS.
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const ideas = await prisma.paletteIdea.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        colors: true,
        tags: true,
        sortOrder: true,
      },
    });

    return NextResponse.json({
      ideas: ideas.map((i) => ({
        ...i,
        colors: Array.isArray(i.colors) ? (i.colors as string[]) : [],
      })),
    });
  } catch (err) {
    console.error("[palette-ideas] GET error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
