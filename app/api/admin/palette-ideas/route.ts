// -----------------------------------------------------------------------------
// @file: app/api/admin/palette-ideas/route.ts
// @purpose: Admin — list all palette ideas + create. Mirrors admin/showcase.
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";
import { generateSlug } from "@/lib/slug";
import { normalizeHex } from "@/lib/colors";

function cleanColors(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((c) => (typeof c === "string" ? normalizeHex(c) : null))
    .filter((c): c is string => Boolean(c))
    .slice(0, 12);
}

function cleanTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((t): t is string => typeof t === "string" && t.trim().length > 0);
}

export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();
    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const ideas = await prisma.paletteIdea.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ ideas });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[admin/palette-ideas] GET error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUserOrThrow();
    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const body = (await req.json()) as any;
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) return NextResponse.json({ error: "TITLE_REQUIRED" }, { status: 400 });

    const colors = cleanColors(body?.colors);
    if (colors.length === 0) {
      return NextResponse.json({ error: "AT_LEAST_ONE_COLOR" }, { status: 400 });
    }

    const slug = (typeof body?.slug === "string" && body.slug.trim()) || generateSlug(title);
    const data: any = {
      title,
      slug,
      summary: body?.summary ?? null,
      colors,
      tags: cleanTags(body?.tags),
      status: body?.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
      sortOrder: Number.isFinite(body?.sortOrder) ? Number(body.sortOrder) : 0,
    };
    if (data.status === "PUBLISHED") data.publishedAt = new Date();

    let idea;
    try {
      idea = await prisma.paletteIdea.create({ data });
    } catch (createErr: any) {
      if (createErr?.code === "P2002") {
        data.slug = `${slug}-${crypto.randomUUID().slice(0, 4)}`;
        idea = await prisma.paletteIdea.create({ data });
      } else {
        throw createErr;
      }
    }

    return NextResponse.json({ idea }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[admin/palette-ideas] POST error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
