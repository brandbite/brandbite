// -----------------------------------------------------------------------------
// @file: app/api/help/categories/route.ts
// @purpose: Public API for listing help categories (role-filtered)
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
// GET: published categories filtered by the current user's role
// -----------------------------------------------------------------------------

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    // Determine which targetRole values this user can see
    const roleFilter: HelpTargetRole[] = ["ALL"];
    if (isCustomerRole(user.role)) roleFilter.push("CUSTOMER");
    else if (isDesignerRole(user.role)) roleFilter.push("DESIGNER");
    else if (isSiteAdminRole(user.role)) {
      roleFilter.push("CUSTOMER", "DESIGNER");
    }

    const categories = await prisma.helpCategory.findMany({
      where: {
        published: true,
        targetRole: { in: roleFilter },
      },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: {
            articles: {
              where: { published: true, targetRole: { in: roleFilter } },
            },
          },
        },
      },
    });

    // Only return categories that have at least 1 visible article
    const items = categories
      .filter((cat) => cat._count.articles > 0)
      .map((cat) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        icon: cat.icon,
        articleCount: cat._count.articles,
      }));

    return NextResponse.json({ categories: items });
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[help.categories] GET error", error);
    return NextResponse.json(
      { error: "Failed to load help categories" },
      { status: 500 },
    );
  }
}
