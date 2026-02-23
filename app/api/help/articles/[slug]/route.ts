// -----------------------------------------------------------------------------
// @file: app/api/help/articles/[slug]/route.ts
// @purpose: Public API for reading a single help article by slug
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-02-23
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole, isDesignerRole, isCustomerRole } from "@/lib/roles";
import type { HelpTargetRole } from "@prisma/client";

// -----------------------------------------------------------------------------
// GET: single article by slug (increments view count)
// -----------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const user = await getCurrentUserOrThrow();

    const roleFilter: HelpTargetRole[] = ["ALL"];
    if (isCustomerRole(user.role)) roleFilter.push("CUSTOMER");
    else if (isDesignerRole(user.role)) roleFilter.push("DESIGNER");
    else if (isSiteAdminRole(user.role)) {
      roleFilter.push("CUSTOMER", "DESIGNER");
    }

    const { slug } = await context.params;

    const article = await prisma.helpArticle.findUnique({
      where: { slug },
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!article || !article.published || !roleFilter.includes(article.targetRole)) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // Increment view count (fire-and-forget)
    prisma.helpArticle
      .update({
        where: { id: article.id },
        data: { viewCount: { increment: 1 } },
      })
      .catch(() => {});

    return NextResponse.json({
      article: {
        id: article.id,
        title: article.title,
        slug: article.slug,
        excerpt: article.excerpt,
        content: article.content,
        categoryId: article.category.id,
        categoryName: article.category.name,
        categorySlug: article.category.slug,
        updatedAt: article.updatedAt.toISOString(),
      },
    });
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[help.articles.slug] GET error", error);
    return NextResponse.json(
      { error: "Failed to load help article" },
      { status: 500 },
    );
  }
}
