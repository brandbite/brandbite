// -----------------------------------------------------------------------------
// @file: app/api/pages/[pageKey]/route.ts
// @purpose: Public — read a single CMS page by key (no auth required)
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ pageKey: string }> }) {
  try {
    const { pageKey } = await params;

    const page = await prisma.cmsPage.findUnique({
      where: { pageKey },
    });

    if (!page) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ page });
  } catch (err) {
    console.error("[api/pages/[pageKey]] GET error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
