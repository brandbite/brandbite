// -----------------------------------------------------------------------------
// @file: app/api/admin/job-type-categories/migrate/route.ts
// @purpose: One-time migration — convert free-text categories to structured records
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-02-20
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";

/** Known categories with their default icons and sort order */
const KNOWN_CATEGORIES: Record<
  string,
  { icon: string; sortOrder: number }
> = {
  "Brand Strategy & Creative Direction": { icon: "\u2728", sortOrder: 0 },
  "Copywriting & Creative Writing": { icon: "\u270D\uFE0F", sortOrder: 1 },
  "Visual Design & Brand Identity": { icon: "\uD83C\uDFA8", sortOrder: 2 },
  "Digital Content & Marketing": { icon: "\uD83D\uDCF1", sortOrder: 3 },
  "Video & Motion Production": { icon: "\uD83C\uDFAC", sortOrder: 4 },
};

// ---------------------------------------------------------------------------
// POST: Migrate text-based categories to structured JobTypeCategory records
// ---------------------------------------------------------------------------

export async function POST(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json(
        { error: "Only site admins can run migrations" },
        { status: 403 },
      );
    }

    // Check if categories already exist
    const existingCount = await prisma.jobTypeCategory.count();
    if (existingCount > 0) {
      return NextResponse.json(
        { error: "Categories already exist. Migration skipped." },
        { status: 409 },
      );
    }

    // Get all unique text categories from job types
    const jobTypes = await prisma.jobType.findMany({
      where: { category: { not: null } },
      select: { id: true, category: true },
    });

    const uniqueCategories = [
      ...new Set(
        jobTypes
          .map((jt) => jt.category?.trim())
          .filter((c): c is string => !!c),
      ),
    ];

    if (uniqueCategories.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No text categories found to migrate.",
        created: 0,
        linked: 0,
      });
    }

    // Sort: known categories first (in KNOWN_CATEGORIES order), then unknown alphabetically
    uniqueCategories.sort((a, b) => {
      const aKnown = KNOWN_CATEGORIES[a];
      const bKnown = KNOWN_CATEGORIES[b];
      if (aKnown && bKnown) return aKnown.sortOrder - bKnown.sortOrder;
      if (aKnown) return -1;
      if (bKnown) return 1;
      return a.localeCompare(b);
    });

    // Create category records
    let nextSortOrder = 0;
    const categoryMap = new Map<string, string>(); // name -> id

    for (const catName of uniqueCategories) {
      const known = KNOWN_CATEGORIES[catName];
      const slug = catName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 50);

      const cat = await prisma.jobTypeCategory.create({
        data: {
          name: catName,
          slug,
          icon: known?.icon ?? null,
          sortOrder: known?.sortOrder ?? nextSortOrder,
        },
      });

      categoryMap.set(catName, cat.id);
      nextSortOrder = Math.max(nextSortOrder, (known?.sortOrder ?? nextSortOrder) + 1);
    }

    // Link job types to their new categories
    let linked = 0;
    for (const jt of jobTypes) {
      const catName = jt.category?.trim();
      if (!catName) continue;

      const categoryId = categoryMap.get(catName);
      if (!categoryId) continue;

      await prisma.jobType.update({
        where: { id: jt.id },
        data: { categoryId },
      });
      linked++;
    }

    return NextResponse.json({
      success: true,
      message: `Migrated ${categoryMap.size} categories, linked ${linked} job types.`,
      created: categoryMap.size,
      linked,
    });
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[admin.job-type-categories.migrate] POST error", error);
    return NextResponse.json(
      { error: "Migration failed" },
      { status: 500 },
    );
  }
}
