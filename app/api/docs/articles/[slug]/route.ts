// -----------------------------------------------------------------------------
// @file: app/api/docs/articles/[slug]/route.ts
// @purpose: Public — read a single published doc article by slug
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;

    const article = await prisma.docArticle.findUnique({
      where: { slug },
      include: {
        category: {
          select: { id: true, title: true, slug: true, audience: true },
        },
      },
    });

    if (!article || article.status !== "PUBLISHED") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ article });
  } catch (err) {
    console.error("[api/docs/articles/[slug]] GET error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
