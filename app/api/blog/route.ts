// -----------------------------------------------------------------------------
// @file: app/api/blog/route.ts
// @purpose: Public — list published blog posts for the marketing site
// @version: v0.1.0
// @status: active
// @lastUpdate: 2026-02-23
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// GET — list published blog posts (public, no auth required)
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const posts = await prisma.blogPost.findMany({
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

    return NextResponse.json({ posts });
  } catch (err: any) {
    console.error("[blog] GET error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
