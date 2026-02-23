// -----------------------------------------------------------------------------
// @file: app/api/admin/help-categories/route.ts
// @purpose: Admin API for managing help center categories
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
// GET: list all help categories (with article counts)
// -----------------------------------------------------------------------------

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json(
        { error: "Only site admins can access help categories" },
        { status: 403 },
      );
    }

    const categories = await prisma.helpCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { articles: true } },
      },
    });

    const items = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      icon: cat.icon,
      sortOrder: cat.sortOrder,
      targetRole: cat.targetRole,
      published: cat.published,
      articleCount: cat._count.articles,
      createdAt: cat.createdAt.toISOString(),
      updatedAt: cat.updatedAt.toISOString(),
    }));

    return NextResponse.json({ categories: items });
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin.help-categories] GET error", error);
    return NextResponse.json(
      { error: "Failed to load help categories" },
      { status: 500 },
    );
  }
}

// -----------------------------------------------------------------------------
// POST: create a new help category
// -----------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json(
        { error: "Only site admins can create help categories" },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);

    const name = (body?.name as string | undefined)?.trim();
    if (!name) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 },
      );
    }

    let slug = (body?.slug as string | undefined)?.trim() || generateSlug(name);

    // Ensure slug uniqueness
    const existing = await prisma.helpCategory.findUnique({ where: { slug } });
    if (existing) {
      let suffix = 2;
      while (await prisma.helpCategory.findUnique({ where: { slug: `${slug}-${suffix}` } })) {
        suffix++;
      }
      slug = `${slug}-${suffix}`;
    }

    const description = (body?.description as string | undefined)?.trim() || null;
    const icon = (body?.icon as string | undefined)?.trim() || null;
    const sortOrder = typeof body?.sortOrder === "number" ? body.sortOrder : 0;
    const targetRole = ["CUSTOMER", "DESIGNER", "ALL"].includes(body?.targetRole)
      ? body.targetRole
      : "ALL";
    const published = typeof body?.published === "boolean" ? body.published : true;

    const created = await prisma.helpCategory.create({
      data: { name, slug, description, icon, sortOrder, targetRole, published },
    });

    return NextResponse.json(
      {
        category: {
          id: created.id,
          name: created.name,
          slug: created.slug,
          description: created.description,
          icon: created.icon,
          sortOrder: created.sortOrder,
          targetRole: created.targetRole,
          published: created.published,
          articleCount: 0,
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
    console.error("[admin.help-categories] POST error", error);
    return NextResponse.json(
      { error: "Failed to create help category" },
      { status: 500 },
    );
  }
}
