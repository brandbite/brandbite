// -----------------------------------------------------------------------------
// @file: app/api/admin/color-meanings/[meaningId]/route.ts
// @purpose: Admin — update or delete a color meaning. Field-allowlisted PATCH.
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";
import { normalizeHex } from "@/lib/colors";

export async function PATCH(req: Request, { params }: { params: Promise<{ meaningId: string }> }) {
  try {
    const user = await getCurrentUserOrThrow();
    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const { meaningId } = await params;
    const body = (await req.json()) as any;

    const data: any = {};
    if (typeof body?.name === "string") data.name = body.name.trim();
    if (typeof body?.slug === "string" && body.slug.trim()) data.slug = body.slug.trim();
    if (typeof body?.hex === "string") {
      const hex = normalizeHex(body.hex);
      if (!hex) return NextResponse.json({ error: "VALID_HEX_REQUIRED" }, { status: 400 });
      data.hex = hex;
    }
    if ("summary" in body) data.summary = body.summary ?? null;
    if ("meaning" in body) data.meaning = body.meaning ?? null;
    if ("metaTitle" in body) data.metaTitle = body.metaTitle ?? null;
    if ("metaDescription" in body) data.metaDescription = body.metaDescription ?? null;
    if (Array.isArray(body?.associations)) {
      data.associations = body.associations.filter(
        (t: unknown) => typeof t === "string" && t.trim(),
      );
    }
    if (Array.isArray(body?.samplePalettes)) {
      data.samplePalettes = body.samplePalettes
        .map((row: unknown) =>
          Array.isArray(row)
            ? row
                .map((c: unknown) => (typeof c === "string" ? normalizeHex(c) : null))
                .filter((c: string | null): c is string => Boolean(c))
            : [],
        )
        .filter((row: string[]) => row.length > 0);
    }
    if (Number.isFinite(body?.sortOrder)) data.sortOrder = Number(body.sortOrder);
    if (body?.status === "PUBLISHED" || body?.status === "DRAFT") data.status = body.status;

    if (data.status === "PUBLISHED") {
      const existing = await prisma.colorMeaning.findUnique({
        where: { id: meaningId },
        select: { publishedAt: true },
      });
      if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
      if (!existing.publishedAt) data.publishedAt = new Date();
    }

    const meaning = await prisma.colorMeaning.update({ where: { id: meaningId }, data });
    return NextResponse.json({ meaning });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    console.error("[admin/color-meanings/[meaningId]] PATCH error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ meaningId: string }> },
) {
  try {
    const user = await getCurrentUserOrThrow();
    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const { meaningId } = await params;
    await prisma.colorMeaning.delete({ where: { id: meaningId } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    console.error("[admin/color-meanings/[meaningId]] DELETE error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
