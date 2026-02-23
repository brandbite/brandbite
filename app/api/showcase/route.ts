// -----------------------------------------------------------------------------
// @file: app/api/showcase/route.ts
// @purpose: Public — list published showcase works for the marketing site
// @version: v0.1.0
// @status: active
// @lastUpdate: 2026-02-23
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// GET — list published showcase works (public, no auth required)
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const works = await prisma.showcaseWork.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        slug: true,
        subtitle: true,
        clientName: true,
        category: true,
        tags: true,
        thumbnailUrl: true,
        sortOrder: true,
      },
    });

    return NextResponse.json({ works });
  } catch (err: any) {
    console.error("[showcase] GET error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
