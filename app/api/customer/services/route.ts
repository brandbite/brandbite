// -----------------------------------------------------------------------------
// @file: app/api/customer/services/route.ts
// @purpose: Customer-facing service catalog — lists active job types
// @version: v1.0.0
// @status: active
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";

// ---------------------------------------------------------------------------
// GET: all active job types for the service catalog
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customers can access the service catalog" },
        { status: 403 },
      );
    }

    const jobTypes = await prisma.jobType.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        category: true,
        categoryId: true,
        categoryRef: {
          select: { id: true, name: true, slug: true, icon: true, sortOrder: true },
        },
        description: true,
        tokenCost: true,
        estimatedHours: true,
        hasQuantity: true,
        quantityLabel: true,
        defaultQuantity: true,
      },
      orderBy: { name: "asc" },
    });

    // Also fetch all active categories for proper ordering
    const categories = await prisma.jobTypeCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true, icon: true, sortOrder: true },
      orderBy: { sortOrder: "asc" },
    });

    // Map services — prefer categoryRef.name over legacy text field
    const services = jobTypes.map((jt) => ({
      id: jt.id,
      name: jt.name,
      category: jt.categoryRef?.name ?? jt.category,
      categoryIcon: jt.categoryRef?.icon ?? null,
      categorySortOrder: jt.categoryRef?.sortOrder ?? 999,
      description: jt.description,
      tokenCost: jt.tokenCost,
      estimatedHours: jt.estimatedHours,
      hasQuantity: jt.hasQuantity,
      quantityLabel: jt.quantityLabel,
      defaultQuantity: jt.defaultQuantity,
    }));

    return NextResponse.json({ services, categories });
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[customer.services] GET error", error);
    return NextResponse.json(
      { error: "Failed to load services" },
      { status: 500 },
    );
  }
}
