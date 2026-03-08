// -----------------------------------------------------------------------------
// @file: app/api/customer/moodboards/[moodboardId]/items/reorder/route.ts
// @purpose: Reorder moodboard items by updating positions in a transaction
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-03-09
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { canManageMoodboards } from "@/lib/permissions/companyRoles";

type RouteParams = { params: Promise<{ moodboardId: string }> };

// -----------------------------------------------------------------------------
// PATCH: reorder items
// -----------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  { params }: RouteParams,
) {
  try {
    const user = await getCurrentUserOrThrow();
    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customers can access moodboards" },
        { status: 403 },
      );
    }
    if (!user.activeCompanyId) {
      return NextResponse.json(
        { error: "No active company" },
        { status: 400 },
      );
    }

    if (!canManageMoodboards(user.companyRole ?? null)) {
      return NextResponse.json(
        { error: "You don't have permission to manage moodboards" },
        { status: 403 },
      );
    }

    const { moodboardId } = await params;

    // Verify moodboard belongs to user's company
    const moodboard = await prisma.moodboard.findUnique({
      where: { id: moodboardId },
      select: { id: true, companyId: true },
    });

    if (!moodboard) {
      return NextResponse.json(
        { error: "Moodboard not found" },
        { status: 404 },
      );
    }

    if (moodboard.companyId !== user.activeCompanyId) {
      return NextResponse.json(
        { error: "Moodboard not found" },
        { status: 404 },
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const raw = body as Record<string, unknown>;
    const orderedItemIds = raw.orderedItemIds;

    if (!Array.isArray(orderedItemIds) || orderedItemIds.length === 0) {
      return NextResponse.json(
        { error: "orderedItemIds must be a non-empty array of strings" },
        { status: 400 },
      );
    }

    // Validate all IDs are strings
    if (!orderedItemIds.every((id): id is string => typeof id === "string")) {
      return NextResponse.json(
        { error: "orderedItemIds must contain only strings" },
        { status: 400 },
      );
    }

    // Verify all items belong to this moodboard
    const existingItems = await prisma.moodboardItem.findMany({
      where: { moodboardId },
      select: { id: true },
    });

    const existingIds = new Set(existingItems.map((item) => item.id));
    const invalidIds = orderedItemIds.filter((id) => !existingIds.has(id));

    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: "Some item IDs do not belong to this moodboard" },
        { status: 400 },
      );
    }

    // Update all positions in a transaction
    await prisma.$transaction(
      orderedItemIds.map((id, index) =>
        prisma.moodboardItem.update({
          where: { id },
          data: { position: index },
        }),
      ),
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "UNAUTHENTICATED" },
        { status: 401 },
      );
    }
    console.error("[moodboards/items/reorder] PATCH error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
