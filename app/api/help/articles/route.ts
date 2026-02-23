// -----------------------------------------------------------------------------
// @file: app/api/help/articles/route.ts
// @purpose: Public API for listing help articles (role-filtered, searchable)
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
// GET: role-filtered article list
//   ?categorySlug=  — filter by category slug
//   ?search=        — search title + excerpt (case-insensitive)
// -----------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    const roleFilter: HelpTargetRole[] = ["ALL"];
    if (isCustomerRole(user.role)) roleFilter.push("CUSTOMER");
    else if (isDesignerRole(user.role)) roleFilter.push("DESIGNER");
    else if (isSiteAdminRole(user.role)) {
      roleFilter.push("CUSTOMER", "DESIGNER");
    }

    const { searchParams } = new URL(req.url);
    const categorySlug = searchParams.get("categorySlug");
    const search = searchParams.get("search")?.trim();

    const where: Record<string, unknown> = {
      published: true,
      targetRole: { in: roleFilter },
    };

    if (categorySlug) {
      const category = await prisma.helpCategory.findUnique({
        where: { slug: categorySlug },
        select: { id: true },
      });
      if (category) {
        where.categoryId = category.id;
      } else {
        return NextResponse.json({ articles: [] });
      }
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { excerpt: { contains: search, mode: "insensitive" } },
      ];
    }

    const articles = await prisma.helpArticle.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    const items = articles.map((a) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      excerpt: a.excerpt,
      categoryId: a.category.id,
      categoryName: a.category.name,
      categorySlug: a.category.slug,
    }));

    return NextResponse.json({ articles: items });
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[help.articles] GET error", error);
    return NextResponse.json(
      { error: "Failed to load help articles" },
      { status: 500 },
    );
  }
}
