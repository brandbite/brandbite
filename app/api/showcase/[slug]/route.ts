// -----------------------------------------------------------------------------
// @file: app/api/showcase/[slug]/route.ts
// @purpose: Public — get a single published showcase work by slug
// @version: v0.1.0
// @status: active
// @lastUpdate: 2026-02-23
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// GET — fetch a single published showcase work (public, no auth required)
// ---------------------------------------------------------------------------

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;

    const work = await prisma.showcaseWork.findFirst({
      where: { slug, status: "PUBLISHED" },
    });

    if (!work) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ work });
  } catch (err: any) {
    console.error("[showcase/[slug]] GET error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
