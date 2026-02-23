// -----------------------------------------------------------------------------
// @file: app/api/admin/help-articles/route.ts
// @purpose: Admin API for listing and creating help articles
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-02-23
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// -----------------------------------------------------------------------------
// GET: list all help articles (without full content)
// -----------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json(
        { error: "Only site admins can access help articles" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId");

    const where: Record<string, unknown> = {};
    if (categoryId) where.categoryId = categoryId;

    const articles = await prisma.helpArticle.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    const items = articles.map((a) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      excerpt: a.excerpt,
      categoryId: a.categoryId,
      categoryName: a.category.name,
      targetRole: a.targetRole,
      published: a.published,
      sortOrder: a.sortOrder,
      viewCount: a.viewCount,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    }));

    return NextResponse.json({ articles: items });
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin.help-articles] GET error", error);
    return NextResponse.json(
      { error: "Failed to load help articles" },
      { status: 500 },
    );
  }
}

// -----------------------------------------------------------------------------
// POST: create a new help article
// -----------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json(
        { error: "Only site admins can create help articles" },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);

    const title = (body?.title as string | undefined)?.trim();
    if (!title) {
      return NextResponse.json(
        { error: "Article title is required" },
        { status: 400 },
      );
    }

    const content = (body?.content as string | undefined)?.trim();
    if (!content) {
      return NextResponse.json(
        { error: "Article content is required" },
        { status: 400 },
      );
    }

    const categoryId = body?.categoryId as string | undefined;
    if (!categoryId) {
      return NextResponse.json(
        { error: "Category is required" },
        { status: 400 },
      );
    }

    // Verify category exists
    const category = await prisma.helpCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 400 },
      );
    }

    let slug = (body?.slug as string | undefined)?.trim() || generateSlug(title);

    // Ensure slug uniqueness
    const existing = await prisma.helpArticle.findUnique({ where: { slug } });
    if (existing) {
      let suffix = 2;
      while (await prisma.helpArticle.findUnique({ where: { slug: `${slug}-${suffix}` } })) {
        suffix++;
      }
      slug = `${slug}-${suffix}`;
    }

    const excerpt = (body?.excerpt as string | undefined)?.trim() || null;
    const sortOrder = typeof body?.sortOrder === "number" ? body.sortOrder : 0;
    const targetRole = ["CUSTOMER", "DESIGNER", "ALL"].includes(body?.targetRole)
      ? body.targetRole
      : "ALL";
    const published = typeof body?.published === "boolean" ? body.published : true;

    const created = await prisma.helpArticle.create({
      data: {
        title,
        slug,
        excerpt,
        content,
        categoryId,
        targetRole,
        published,
        sortOrder,
      },
      include: { category: { select: { id: true, name: true } } },
    });

    return NextResponse.json(
      {
        article: {
          id: created.id,
          title: created.title,
          slug: created.slug,
          excerpt: created.excerpt,
          content: created.content,
          categoryId: created.categoryId,
          categoryName: created.category.name,
          targetRole: created.targetRole,
          published: created.published,
          sortOrder: created.sortOrder,
          viewCount: created.viewCount,
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin.help-articles] POST error", error);
    return NextResponse.json(
      { error: "Failed to create help article" },
      { status: 500 },
    );
  }
}
