// -----------------------------------------------------------------------------
// @file: app/api/admin/help-articles/[articleId]/route.ts
// @purpose: Admin API for reading, updating, and deleting a single help article
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-02-23
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";

// -----------------------------------------------------------------------------
// GET: single article with full content (for editor)
// -----------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ articleId: string }> },
) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json(
        { error: "Only site admins can access help articles" },
        { status: 403 },
      );
    }

    const { articleId } = await context.params;

    const article = await prisma.helpArticle.findUnique({
      where: { id: articleId },
      include: { category: { select: { id: true, name: true } } },
    });

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    return NextResponse.json({
      article: {
        id: article.id,
        title: article.title,
        slug: article.slug,
        excerpt: article.excerpt,
        content: article.content,
        categoryId: article.categoryId,
        categoryName: article.category.name,
        targetRole: article.targetRole,
        published: article.published,
        sortOrder: article.sortOrder,
        viewCount: article.viewCount,
        createdAt: article.createdAt.toISOString(),
        updatedAt: article.updatedAt.toISOString(),
      },
    });
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin.help-articles] GET error", error);
    return NextResponse.json(
      { error: "Failed to load help article" },
      { status: 500 },
    );
  }
}

// -----------------------------------------------------------------------------
// PATCH: update a help article
// -----------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ articleId: string }> },
) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json(
        { error: "Only site admins can update help articles" },
        { status: 403 },
      );
    }

    const { articleId } = await context.params;
    const body = await req.json().catch(() => null);

    const data: Record<string, unknown> = {};

    if (typeof body?.title === "string") {
      const trimmed = body.title.trim();
      if (!trimmed) {
        return NextResponse.json(
          { error: "Article title cannot be empty" },
          { status: 400 },
        );
      }
      data.title = trimmed;
    }

    if (typeof body?.slug === "string") {
      const trimmed = body.slug.trim();
      if (trimmed) {
        const existing = await prisma.helpArticle.findFirst({
          where: { slug: trimmed, NOT: { id: articleId } },
        });
        if (existing) {
          return NextResponse.json(
            { error: "An article with this slug already exists" },
            { status: 400 },
          );
        }
        data.slug = trimmed;
      }
    }

    if (body?.excerpt === null) {
      data.excerpt = null;
    } else if (typeof body?.excerpt === "string") {
      data.excerpt = body.excerpt.trim() || null;
    }

    if (typeof body?.content === "string") {
      data.content = body.content;
    }

    if (typeof body?.categoryId === "string") {
      const category = await prisma.helpCategory.findUnique({
        where: { id: body.categoryId },
      });
      if (!category) {
        return NextResponse.json(
          { error: "Category not found" },
          { status: 400 },
        );
      }
      data.categoryId = body.categoryId;
    }

    if (["CUSTOMER", "DESIGNER", "ALL"].includes(body?.targetRole)) {
      data.targetRole = body.targetRole;
    }

    if (typeof body?.published === "boolean") {
      data.published = body.published;
    }

    if (typeof body?.sortOrder === "number") {
      data.sortOrder = body.sortOrder;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updated = await prisma.helpArticle.update({
      where: { id: articleId },
      data,
      include: { category: { select: { id: true, name: true } } },
    });

    return NextResponse.json({
      article: {
        id: updated.id,
        title: updated.title,
        slug: updated.slug,
        excerpt: updated.excerpt,
        content: updated.content,
        categoryId: updated.categoryId,
        categoryName: updated.category.name,
        targetRole: updated.targetRole,
        published: updated.published,
        sortOrder: updated.sortOrder,
        viewCount: updated.viewCount,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin.help-articles] PATCH error", error);
    return NextResponse.json(
      { error: "Failed to update help article" },
      { status: 500 },
    );
  }
}

// -----------------------------------------------------------------------------
// DELETE: delete a help article
// -----------------------------------------------------------------------------

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ articleId: string }> },
) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json(
        { error: "Only site admins can delete help articles" },
        { status: 403 },
      );
    }

    const { articleId } = await context.params;

    await prisma.helpArticle.delete({ where: { id: articleId } });

    return NextResponse.json({ deleted: true });
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin.help-articles] DELETE error", error);
    return NextResponse.json(
      { error: "Failed to delete help article" },
      { status: 500 },
    );
  }
}
