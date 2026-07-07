// -----------------------------------------------------------------------------
// @file: app/api/admin/palette-ideas/[ideaId]/route.ts
// @purpose: Admin — update or delete a palette idea. Field-allowlisted PATCH.
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";
import { normalizeHex } from "@/lib/colors";

export async function PATCH(req: Request, { params }: { params: Promise<{ ideaId: string }> }) {
  try {
    const user = await getCurrentUserOrThrow();
    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const { ideaId } = await params;
    const body = (await req.json()) as any;

    // Allow-list the writable fields (don't spread raw body into prisma).
    const data: any = {};
    if (typeof body?.title === "string") data.title = body.title.trim();
    if (typeof body?.slug === "string" && body.slug.trim()) data.slug = body.slug.trim();
    if ("summary" in body) data.summary = body.summary ?? null;
    if (Array.isArray(body?.colors)) {
      data.colors = body.colors
        .map((c: unknown) => (typeof c === "string" ? normalizeHex(c) : null))
        .filter((c: string | null): c is string => Boolean(c))
        .slice(0, 12);
    }
    if (Array.isArray(body?.tags)) {
      data.tags = body.tags.filter((t: unknown) => typeof t === "string" && t.trim());
    }
    if (Number.isFinite(body?.sortOrder)) data.sortOrder = Number(body.sortOrder);
    if (body?.status === "PUBLISHED" || body?.status === "DRAFT") data.status = body.status;

    if (data.status === "PUBLISHED") {
      const existing = await prisma.paletteIdea.findUnique({
        where: { id: ideaId },
        select: { publishedAt: true },
      });
      if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
      if (!existing.publishedAt) data.publishedAt = new Date();
    }

    const idea = await prisma.paletteIdea.update({ where: { id: ideaId }, data });
    return NextResponse.json({ idea });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    console.error("[admin/palette-ideas/[ideaId]] PATCH error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ ideaId: string }> }) {
  try {
    const user = await getCurrentUserOrThrow();
    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const { ideaId } = await params;
    await prisma.paletteIdea.delete({ where: { id: ideaId } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    console.error("[admin/palette-ideas/[ideaId]] DELETE error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
