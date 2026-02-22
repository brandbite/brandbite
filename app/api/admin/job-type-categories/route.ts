// -----------------------------------------------------------------------------
// @file: app/api/admin/job-type-categories/route.ts
// @purpose: Admin API for listing and creating job type categories
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-02-20
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";
import { parseBody } from "@/lib/schemas/helpers";
import { createJobTypeCategorySchema } from "@/lib/schemas/job-type-category.schemas";

// ---------------------------------------------------------------------------
// GET: List all job type categories (with job type counts)
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json(
        { error: "Only site admins can access job type categories" },
        { status: 403 },
      );
    }

    const categories = await prisma.jobTypeCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { jobTypes: true } },
      },
    });

    const items = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      icon: cat.icon,
      sortOrder: cat.sortOrder,
      isActive: cat.isActive,
      jobTypeCount: cat._count.jobTypes,
      createdAt: cat.createdAt.toISOString(),
      updatedAt: cat.updatedAt.toISOString(),
    }));

    return NextResponse.json({ categories: items });
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[admin.job-type-categories] GET error", error);
    return NextResponse.json({ error: "Failed to load categories" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST: Create a new job type category
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json(
        { error: "Only site admins can create categories" },
        { status: 403 },
      );
    }

    const parsed = await parseBody(req, createJobTypeCategorySchema);
    if (!parsed.success) return parsed.response;
    const { name, icon, sortOrder } = parsed.data;

    // Generate slug from name (or use provided)
    const slug =
      parsed.data.slug ||
      name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 50);

    try {
      const category = await prisma.jobTypeCategory.create({
        data: { name, slug, icon, sortOrder },
      });

      return NextResponse.json(
        {
          category: {
            id: category.id,
            name: category.name,
            slug: category.slug,
            icon: category.icon,
            sortOrder: category.sortOrder,
            isActive: category.isActive,
            jobTypeCount: 0,
          },
        },
        { status: 201 },
      );
    } catch (err: any) {
      if (err?.code === "P2002") {
        return NextResponse.json(
          { error: "A category with that name or slug already exists." },
          { status: 409 },
        );
      }
      throw err;
    }
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[admin.job-type-categories] POST error", error);
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
