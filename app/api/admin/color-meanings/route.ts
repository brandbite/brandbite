// -----------------------------------------------------------------------------
// @file: app/api/admin/color-meanings/route.ts
// @purpose: Admin — list all color meanings + create. Mirrors admin/showcase.
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";
import { generateSlug } from "@/lib/slug";
import { normalizeHex } from "@/lib/colors";

function cleanStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((t): t is string => typeof t === "string" && t.trim().length > 0);
}

/** Sample palettes: array of hex arrays. Normalizes + drops invalids. */
function cleanSamplePalettes(input: unknown): string[][] {
  if (!Array.isArray(input)) return [];
  return input
    .map((row) =>
      Array.isArray(row)
        ? row
            .map((c) => (typeof c === "string" ? normalizeHex(c) : null))
            .filter((c): c is string => Boolean(c))
        : [],
    )
    .filter((row) => row.length > 0);
}

export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();
    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const meanings = await prisma.colorMeaning.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ meanings });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[admin/color-meanings] GET error:", err);
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
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "NAME_REQUIRED" }, { status: 400 });

    const hex = typeof body?.hex === "string" ? normalizeHex(body.hex) : null;
    if (!hex) return NextResponse.json({ error: "VALID_HEX_REQUIRED" }, { status: 400 });

    const slug = (typeof body?.slug === "string" && body.slug.trim()) || generateSlug(name);
    const data: any = {
      name,
      slug,
      hex,
      summary: body?.summary ?? null,
      meaning: body?.meaning ?? null,
      associations: cleanStringArray(body?.associations),
      samplePalettes: cleanSamplePalettes(body?.samplePalettes),
      metaTitle: body?.metaTitle ?? null,
      metaDescription: body?.metaDescription ?? null,
      status: body?.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
      sortOrder: Number.isFinite(body?.sortOrder) ? Number(body.sortOrder) : 0,
    };
    if (data.status === "PUBLISHED") data.publishedAt = new Date();

    let meaning;
    try {
      meaning = await prisma.colorMeaning.create({ data });
    } catch (createErr: any) {
      if (createErr?.code === "P2002") {
        data.slug = `${slug}-${crypto.randomUUID().slice(0, 4)}`;
        meaning = await prisma.colorMeaning.create({ data });
      } else {
        throw createErr;
      }
    }

    return NextResponse.json({ meaning }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[admin/color-meanings] POST error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
