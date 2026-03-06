// -----------------------------------------------------------------------------
// @file: app/api/admin/docs/categories/route.ts
// @purpose: Admin — list all doc categories + create new category
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";
import { generateSlug } from "@/lib/slug";

// ---------------------------------------------------------------------------
// GET — list all doc categories with article counts
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const categories = await prisma.docCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { articles: true } },
      },
    });

    return NextResponse.json({ categories });
  } catch (err: any) {
    const code = err?.code ?? "UNKNOWN";

    if (code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }

    console.error("[admin/docs/categories] GET error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — create a new doc category
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const body = (await req.json()) as any;

    const title = body?.title as string | undefined;
    if (!title || !title.trim()) {
      return NextResponse.json({ error: "TITLE_REQUIRED" }, { status: 400 });
    }

    const slug = (body?.slug as string | undefined) || generateSlug(title);

    const data: any = {
      title: title.trim(),
      slug,
      description: body?.description ?? null,
      icon: body?.icon ?? null,
      audience: body?.audience ?? "GENERAL",
      sortOrder: body?.sortOrder ?? 0,
    };

    let category;
    try {
      category = await prisma.docCategory.create({ data });
    } catch (createErr: any) {
      if (createErr?.code === "P2002") {
        data.slug = `${slug}-${crypto.randomUUID().slice(0, 4)}`;
        category = await prisma.docCategory.create({ data });
      } else {
        throw createErr;
      }
    }

    return NextResponse.json({ category }, { status: 201 });
  } catch (err: any) {
    const code = err?.code ?? "UNKNOWN";

    if (code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }

    console.error("[admin/docs/categories] POST error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
