// -----------------------------------------------------------------------------
// @file: app/api/admin/docs/articles/route.ts
// @purpose: Admin — list all doc articles + create new article
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";
import { generateSlug } from "@/lib/slug";

// ---------------------------------------------------------------------------
// GET — list all doc articles (admin view, all statuses)
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const articles = await prisma.docArticle.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        category: {
          select: { id: true, title: true, slug: true, audience: true },
        },
      },
    });

    return NextResponse.json({ articles });
  } catch (err: any) {
    const code = err?.code ?? "UNKNOWN";

    if (code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }

    console.error("[admin/docs/articles] GET error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — create a new doc article
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

    const categoryId = body?.categoryId as string | undefined;
    if (!categoryId) {
      return NextResponse.json({ error: "CATEGORY_REQUIRED" }, { status: 400 });
    }

    const slug = (body?.slug as string | undefined) || generateSlug(title);

    const data: any = {
      title: title.trim(),
      slug,
      excerpt: body?.excerpt ?? null,
      body: body?.body ?? null,
      categoryId,
      authorName: body?.authorName ?? null,
      sortOrder: body?.sortOrder ?? 0,
      metaTitle: body?.metaTitle ?? null,
      metaDescription: body?.metaDescription ?? null,
      status: body?.status ?? "DRAFT",
    };

    if (data.status === "PUBLISHED") {
      data.publishedAt = new Date();
    }

    let article;
    try {
      article = await prisma.docArticle.create({ data });
    } catch (createErr: any) {
      if (createErr?.code === "P2002") {
        data.slug = `${slug}-${crypto.randomUUID().slice(0, 4)}`;
        article = await prisma.docArticle.create({ data });
      } else {
        throw createErr;
      }
    }

    return NextResponse.json({ article }, { status: 201 });
  } catch (err: any) {
    const code = err?.code ?? "UNKNOWN";

    if (code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }

    console.error("[admin/docs/articles] POST error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
