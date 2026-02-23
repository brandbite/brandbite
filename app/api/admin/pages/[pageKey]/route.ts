// -----------------------------------------------------------------------------
// @file: app/api/admin/pages/[pageKey]/route.ts
// @purpose: Admin — get or update a single CMS page by key
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";

// ---------------------------------------------------------------------------
// GET — fetch a single CMS page by key
// ---------------------------------------------------------------------------

export async function GET(_req: Request, { params }: { params: Promise<{ pageKey: string }> }) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const { pageKey } = await params;

    const page = await prisma.cmsPage.findUnique({
      where: { pageKey },
    });

    if (!page) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ page });
  } catch (err: any) {
    const code = err?.code ?? "UNKNOWN";

    if (code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }

    console.error("[admin/pages/[pageKey]] GET error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH — update a CMS page
// ---------------------------------------------------------------------------

export async function PATCH(req: Request, { params }: { params: Promise<{ pageKey: string }> }) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const { pageKey } = await params;
    const body = (await req.json()) as any;

    // Only allow updating specific fields
    const data: any = {};
    if (body?.title !== undefined) data.title = body.title;
    if (body?.subtitle !== undefined) data.subtitle = body.subtitle;
    if (body?.heroStorageKey !== undefined) data.heroStorageKey = body.heroStorageKey;
    if (body?.heroUrl !== undefined) data.heroUrl = body.heroUrl;
    if (body?.body !== undefined) data.body = body.body;
    if (body?.metaTitle !== undefined) data.metaTitle = body.metaTitle;
    if (body?.metaDescription !== undefined) data.metaDescription = body.metaDescription;

    const page = await prisma.cmsPage.update({
      where: { pageKey },
      data,
    });

    return NextResponse.json({ page });
  } catch (err: any) {
    const code = err?.code ?? "UNKNOWN";

    if (code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }

    if (err?.code === "P2025") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    console.error("[admin/pages/[pageKey]] PATCH error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
