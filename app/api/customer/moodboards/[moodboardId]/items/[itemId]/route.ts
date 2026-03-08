// -----------------------------------------------------------------------------
// @file: app/api/customer/moodboards/[moodboardId]/items/[itemId]/route.ts
// @purpose: Update and delete individual moodboard items
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-03-09
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { canManageMoodboards } from "@/lib/permissions/companyRoles";

type RouteParams = {
  params: Promise<{ moodboardId: string; itemId: string }>;
};

// -----------------------------------------------------------------------------
// PATCH: update an item's data or colSpan
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

    const { moodboardId, itemId } = await params;

    // Verify ownership chain: item -> moodboard -> company
    const item = await prisma.moodboardItem.findUnique({
      where: { id: itemId },
      include: {
        moodboard: {
          select: { id: true, companyId: true },
        },
      },
    });

    if (!item) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 },
      );
    }

    if (item.moodboardId !== moodboardId) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 },
      );
    }

    if (item.moodboard.companyId !== user.activeCompanyId) {
      return NextResponse.json(
        { error: "Item not found" },
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
    const data: Record<string, unknown> = {};

    if (raw.data !== undefined) {
      if (!raw.data || typeof raw.data !== "object") {
        return NextResponse.json(
          { error: "Item data must be an object" },
          { status: 400 },
        );
      }
      data.data = raw.data;
    }

    if (raw.colSpan !== undefined) {
      if (
        typeof raw.colSpan !== "number" ||
        raw.colSpan < 1 ||
        raw.colSpan > 4
      ) {
        return NextResponse.json(
          { error: "colSpan must be a number between 1 and 4" },
          { status: 400 },
        );
      }
      data.colSpan = Math.floor(raw.colSpan);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      );
    }

    const updated = await prisma.moodboardItem.update({
      where: { id: itemId },
      data,
    });

    return NextResponse.json({
      item: {
        id: updated.id,
        type: updated.type,
        position: updated.position,
        colSpan: updated.colSpan,
        data: updated.data,
        createdById: updated.createdById,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "UNAUTHENTICATED" },
        { status: 401 },
      );
    }
    console.error("[moodboards/items] PATCH error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}

// -----------------------------------------------------------------------------
// DELETE: remove an item from the moodboard
// -----------------------------------------------------------------------------

export async function DELETE(
  _req: NextRequest,
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

    const { moodboardId, itemId } = await params;

    // Verify ownership chain: item -> moodboard -> company
    const item = await prisma.moodboardItem.findUnique({
      where: { id: itemId },
      include: {
        moodboard: {
          select: { id: true, companyId: true },
        },
      },
    });

    if (!item) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 },
      );
    }

    if (item.moodboardId !== moodboardId) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 },
      );
    }

    if (item.moodboard.companyId !== user.activeCompanyId) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 },
      );
    }

    await prisma.moodboardItem.delete({
      where: { id: itemId },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "UNAUTHENTICATED" },
        { status: 401 },
      );
    }
    console.error("[moodboards/items] DELETE error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
