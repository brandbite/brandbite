// -----------------------------------------------------------------------------
// @file: app/api/docs/categories/[slug]/route.ts
// @purpose: Public — get a doc category with its published articles
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;

    const category = await prisma.docCategory.findUnique({
      where: { slug },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        icon: true,
        audience: true,
        articles: {
          where: { status: "PUBLISHED" },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            publishedAt: true,
          },
        },
      },
    });

    if (!category) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ category });
  } catch (err) {
    console.error("[api/docs/categories/[slug]] GET error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
