// -----------------------------------------------------------------------------
// @file: app/api/admin/showcase/route.ts
// @purpose: Admin — list all showcase works + create new showcase work
// @version: v0.1.0
// @status: active
// @lastUpdate: 2026-02-23
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";
import { generateSlug } from "@/lib/slug";

// ---------------------------------------------------------------------------
// GET — list all showcase works (admin view, all statuses)
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const works = await prisma.showcaseWork.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ works });
  } catch (err: any) {
    const code = err?.code ?? "UNKNOWN";

    if (code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }

    console.error("[admin/showcase] GET error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — create a new showcase work
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
      subtitle: body?.subtitle ?? null,
      clientName: body?.clientName ?? null,
      category: body?.category ?? null,
      tags: body?.tags ?? [],
      thumbnailStorageKey: body?.thumbnailStorageKey ?? null,
      thumbnailUrl: body?.thumbnailUrl ?? null,
      heroStorageKey: body?.heroStorageKey ?? null,
      heroUrl: body?.heroUrl ?? null,
      galleryImages: body?.galleryImages ?? null,
      description: body?.description ?? null,
      status: body?.status ?? "DRAFT",
      sortOrder: body?.sortOrder ?? 0,
    };

    // Auto-set publishedAt when publishing
    if (data.status === "PUBLISHED") {
      data.publishedAt = new Date();
    }

    let work;
    try {
      work = await prisma.showcaseWork.create({ data });
    } catch (createErr: any) {
      // P2002 = unique constraint violation (slug collision)
      if (createErr?.code === "P2002") {
        data.slug = `${slug}-${crypto.randomUUID().slice(0, 4)}`;
        work = await prisma.showcaseWork.create({ data });
      } else {
        throw createErr;
      }
    }

    return NextResponse.json({ work }, { status: 201 });
  } catch (err: any) {
    const code = err?.code ?? "UNKNOWN";

    if (code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }

    console.error("[admin/showcase] POST error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
