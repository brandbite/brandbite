// -----------------------------------------------------------------------------
// @file: app/api/docs/categories/route.ts
// @purpose: Public — list doc categories with published article counts
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const categories = await prisma.docCategory.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        icon: true,
        audience: true,
        sortOrder: true,
        _count: {
          select: {
            articles: { where: { status: "PUBLISHED" } },
          },
        },
      },
    });

    return NextResponse.json({ categories });
  } catch (err) {
    console.error("[api/docs/categories] GET error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
