// -----------------------------------------------------------------------------
// @file: app/api/admin/help-categories/[categoryId]/route.ts
// @purpose: Admin API for updating/deleting a single help category
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-02-23
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";
import type { HelpTargetRole } from "@prisma/client";

// -----------------------------------------------------------------------------
// PATCH: update a help category
// -----------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ categoryId: string }> },
) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json(
        { error: "Only site admins can update help categories" },
        { status: 403 },
      );
    }

    const { categoryId } = await context.params;
    const body = await req.json().catch(() => null);

    const data: {
      name?: string;
      slug?: string;
      description?: string | null;
      icon?: string | null;
      sortOrder?: number;
      targetRole?: HelpTargetRole;
      published?: boolean;
    } = {};

    if (typeof body?.name === "string") {
      const trimmed = body.name.trim();
      if (!trimmed) {
        return NextResponse.json(
          { error: "Category name cannot be empty" },
          { status: 400 },
        );
      }
      data.name = trimmed;
    }

    if (typeof body?.slug === "string") {
      const trimmed = body.slug.trim();
      if (trimmed) {
        // Check uniqueness (excluding current category)
        const existing = await prisma.helpCategory.findFirst({
          where: { slug: trimmed, NOT: { id: categoryId } },
        });
        if (existing) {
          return NextResponse.json(
            { error: "A category with this slug already exists" },
            { status: 400 },
          );
        }
        data.slug = trimmed;
      }
    }

    if (body?.description === null) {
      data.description = null;
    } else if (typeof body?.description === "string") {
      data.description = body.description.trim() || null;
    }

    if (body?.icon === null) {
      data.icon = null;
    } else if (typeof body?.icon === "string") {
      data.icon = body.icon.trim() || null;
    }

    if (typeof body?.sortOrder === "number") {
      data.sortOrder = body.sortOrder;
    }

    if (["CUSTOMER", "DESIGNER", "ALL"].includes(body?.targetRole)) {
      data.targetRole = body.targetRole;
    }

    if (typeof body?.published === "boolean") {
      data.published = body.published;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    await prisma.helpCategory.update({
      where: { id: categoryId },
      data,
    });

    const updated = await prisma.helpCategory.findUniqueOrThrow({
      where: { id: categoryId },
      include: { _count: { select: { articles: true } } },
    });

    return NextResponse.json({
      category: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        description: updated.description,
        icon: updated.icon,
        sortOrder: updated.sortOrder,
        targetRole: updated.targetRole,
        published: updated.published,
        articleCount: updated._count.articles,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin.help-categories] PATCH error", error);
    return NextResponse.json(
      { error: "Failed to update help category" },
      { status: 500 },
    );
  }
}

// -----------------------------------------------------------------------------
// DELETE: delete a help category (only if no articles exist)
// -----------------------------------------------------------------------------

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ categoryId: string }> },
) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json(
        { error: "Only site admins can delete help categories" },
        { status: 403 },
      );
    }

    const { categoryId } = await context.params;

    const articleCount = await prisma.helpArticle.count({
      where: { categoryId },
    });

    if (articleCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete category with ${articleCount} existing article(s). Move or delete articles first.`,
        },
        { status: 400 },
      );
    }

    await prisma.helpCategory.delete({ where: { id: categoryId } });

    return NextResponse.json({ deleted: true });
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin.help-categories] DELETE error", error);
    return NextResponse.json(
      { error: "Failed to delete help category" },
      { status: 500 },
    );
  }
}
