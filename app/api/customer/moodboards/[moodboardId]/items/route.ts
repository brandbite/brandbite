// -----------------------------------------------------------------------------
// @file: app/api/customer/moodboards/[moodboardId]/items/route.ts
// @purpose: Add items to a moodboard
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-03-09
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { MoodboardItemType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { canManageMoodboards } from "@/lib/permissions/companyRoles";

type RouteParams = { params: Promise<{ moodboardId: string }> };

const VALID_ITEM_TYPES = new Set<string>(Object.values(MoodboardItemType));

// -----------------------------------------------------------------------------
// POST: add a new item to the moodboard
// -----------------------------------------------------------------------------

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUserOrThrow();
    if (user.role !== "CUSTOMER") {
      return NextResponse.json({ error: "Only customers can access moodboards" }, { status: 403 });
    }
    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "No active company" }, { status: 400 });
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
      return NextResponse.json({ error: "Moodboard not found" }, { status: 404 });
    }

    if (moodboard.companyId !== user.activeCompanyId) {
      return NextResponse.json({ error: "Moodboard not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const raw = body as Record<string, unknown>;

    const type = String(raw.type ?? "");
    if (!VALID_ITEM_TYPES.has(type)) {
      return NextResponse.json({ error: "Invalid item type" }, { status: 400 });
    }

    const data = raw.data;
    if (!data || typeof data !== "object") {
      return NextResponse.json(
        { error: "Item data is required and must be an object" },
        { status: 400 },
      );
    }

    const colSpan =
      typeof raw.colSpan === "number" && raw.colSpan >= 1 && raw.colSpan <= 4
        ? Math.floor(raw.colSpan)
        : 1;

    // Canvas position fields
    const x = typeof raw.x === "number" ? raw.x : 0;
    const y = typeof raw.y === "number" ? raw.y : 0;
    const width = typeof raw.width === "number" && raw.width > 0 ? raw.width : 280;
    const height = typeof raw.height === "number" && raw.height >= 0 ? raw.height : 0;

    // Determine next position (used for z-index ordering)
    const lastItem = await prisma.moodboardItem.findFirst({
      where: { moodboardId },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const position = (lastItem?.position ?? -1) + 1;

    const item = await prisma.moodboardItem.create({
      data: {
        moodboardId,
        type: type as MoodboardItemType,
        position,
        colSpan,
        x,
        y,
        width,
        height,
        data: data as any,
        createdById: user.id,
      },
    });

    return NextResponse.json(
      {
        item: {
          id: item.id,
          type: item.type,
          position: item.position,
          colSpan: item.colSpan,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
          data: item.data,
          createdById: item.createdById,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[moodboards/items] POST error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
