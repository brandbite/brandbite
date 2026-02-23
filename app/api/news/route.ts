// -----------------------------------------------------------------------------
// @file: app/api/news/route.ts
// @purpose: Public — list published news articles (no auth required)
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const articles = await prisma.newsArticle.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        authorName: true,
        category: true,
        tags: true,
        thumbnailUrl: true,
        publishedAt: true,
      },
    });

    return NextResponse.json({ articles });
  } catch (err) {
    console.error("[api/news] GET error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
