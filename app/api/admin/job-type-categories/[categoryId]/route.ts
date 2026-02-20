// -----------------------------------------------------------------------------
// @file: app/api/admin/job-type-categories/[categoryId]/route.ts
// @purpose: Admin API for updating and deleting a job type category
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-02-20
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";

type RouteContext = { params: Promise<{ categoryId: string }> };

// ---------------------------------------------------------------------------
// PATCH: Update a category (name, icon, sortOrder, isActive)
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json(
        { error: "Only site admins can update categories" },
        { status: 403 },
      );
    }

    const { categoryId } = await ctx.params;

    const existing = await prisma.jobTypeCategory.findUnique({
      where: { id: categoryId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Category not found." },
        { status: 404 },
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Request body is required." },
        { status: 400 },
      );
    }

    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name =
        typeof body.name === "string" ? body.name.trim() : "";
      if (name.length < 2) {
        return NextResponse.json(
          { error: "Category name must be at least 2 characters." },
          { status: 400 },
        );
      }
      updateData.name = name;

      // Auto-update slug when name changes
      updateData.slug = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 50);
    }

    if (body.icon !== undefined) {
      updateData.icon =
        typeof body.icon === "string" ? body.icon.trim() || null : null;
    }

    if (typeof body.sortOrder === "number") {
      updateData.sortOrder = body.sortOrder;
    }

    if (typeof body.isActive === "boolean") {
      updateData.isActive = body.isActive;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update." },
        { status: 400 },
      );
    }

    try {
      const category = await prisma.jobTypeCategory.update({
        where: { id: categoryId },
        data: updateData,
        include: {
          _count: { select: { jobTypes: true } },
        },
      });

      return NextResponse.json({
        category: {
          id: category.id,
          name: category.name,
          slug: category.slug,
          icon: category.icon,
          sortOrder: category.sortOrder,
          isActive: category.isActive,
          jobTypeCount: category._count.jobTypes,
        },
      });
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
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[admin.job-type-categories.id] PATCH error", error);
    return NextResponse.json(
      { error: "Failed to update category" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE: Delete a category (unlinks job types, sets their categoryId to null)
// ---------------------------------------------------------------------------

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json(
        { error: "Only site admins can delete categories" },
        { status: 403 },
      );
    }

    const { categoryId } = await ctx.params;

    const existing = await prisma.jobTypeCategory.findUnique({
      where: { id: categoryId },
      include: { _count: { select: { jobTypes: true } } },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Category not found." },
        { status: 404 },
      );
    }

    // Unlink all job types from this category
    const unlinkedJobTypes = existing._count.jobTypes;
    if (unlinkedJobTypes > 0) {
      await prisma.jobType.updateMany({
        where: { categoryId },
        data: { categoryId: null },
      });
    }

    // Delete the category
    await prisma.jobTypeCategory.delete({
      where: { id: categoryId },
    });

    return NextResponse.json(
      { success: true, unlinkedJobTypes },
      { status: 200 },
    );
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[admin.job-type-categories.id] DELETE error", error);
    return NextResponse.json(
      { error: "Failed to delete category" },
      { status: 500 },
    );
  }
}
