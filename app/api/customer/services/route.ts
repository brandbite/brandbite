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
        description: true,
        tokenCost: true,
        estimatedHours: true,
        hasQuantity: true,
        quantityLabel: true,
        defaultQuantity: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ services: jobTypes });
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
