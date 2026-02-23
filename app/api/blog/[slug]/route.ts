// -----------------------------------------------------------------------------
// @file: app/api/blog/[slug]/route.ts
// @purpose: Public — get a single published blog post by slug
// @version: v0.1.0
// @status: active
// @lastUpdate: 2026-02-23
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// GET — fetch a single published blog post (public, no auth required)
// ---------------------------------------------------------------------------

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;

    const post = await prisma.blogPost.findFirst({
      where: { slug, status: "PUBLISHED" },
    });

    if (!post) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ post });
  } catch (err: any) {
    console.error("[blog/[slug]] GET error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
