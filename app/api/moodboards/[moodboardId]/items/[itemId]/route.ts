// -----------------------------------------------------------------------------
// @file: app/api/moodboards/[moodboardId]/items/[itemId]/route.ts
// @purpose: Update and delete individual moodboard items
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-03-09
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { MOODBOARD_ACCESS_SELECT, moodboardAccess } from "@/lib/moodboard-access";
import { storageKeyAllowed } from "@/lib/moodboard-items";

type RouteParams = {
  params: Promise<{ moodboardId: string; itemId: string }>;
};

// -----------------------------------------------------------------------------
// PATCH: update an item's data or colSpan
// -----------------------------------------------------------------------------

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUserOrThrow();
    const { moodboardId, itemId } = await params;

    // Verify ownership chain: item -> moodboard -> company
    const item = await prisma.moodboardItem.findUnique({
      where: { id: itemId },
      include: {
        moodboard: {
          select: { id: true, ...MOODBOARD_ACCESS_SELECT },
        },
      },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (item.moodboardId !== moodboardId) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const access = moodboardAccess(user, item.moodboard);
    if (!access.canView) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    if (!access.canEdit) {
      return NextResponse.json(
        { error: "You don't have permission to change this moodboard" },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const raw = body as Record<string, unknown>;
    const data: Record<string, unknown> = {};

    if (raw.data !== undefined) {
      if (!raw.data || typeof raw.data !== "object") {
        return NextResponse.json({ error: "Item data must be an object" }, { status: 400 });
      }
      if (!storageKeyAllowed(moodboardId, raw.data)) {
        return NextResponse.json({ error: "That file isn't on this moodboard" }, { status: 400 });
      }
      data.data = raw.data;
    }

    if (raw.colSpan !== undefined) {
      if (typeof raw.colSpan !== "number" || raw.colSpan < 1 || raw.colSpan > 4) {
        return NextResponse.json(
          { error: "colSpan must be a number between 1 and 4" },
          { status: 400 },
        );
      }
      data.colSpan = Math.floor(raw.colSpan);
    }

    // Canvas position/size fields
    if (raw.x !== undefined) {
      if (typeof raw.x !== "number") {
        return NextResponse.json({ error: "x must be a number" }, { status: 400 });
      }
      data.x = raw.x;
    }
    if (raw.y !== undefined) {
      if (typeof raw.y !== "number") {
        return NextResponse.json({ error: "y must be a number" }, { status: 400 });
      }
      data.y = raw.y;
    }
    if (raw.width !== undefined) {
      if (typeof raw.width !== "number" || raw.width < 80) {
        return NextResponse.json({ error: "width must be >= 80" }, { status: 400 });
      }
      data.width = raw.width;
    }
    if (raw.height !== undefined) {
      if (typeof raw.height !== "number" || raw.height < 0) {
        return NextResponse.json({ error: "height must be >= 0" }, { status: 400 });
      }
      data.height = raw.height;
    }

    // Undo of a delete.
    if (raw.restore === true) {
      data.deletedAt = null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
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
        x: updated.x,
        y: updated.y,
        width: updated.width,
        height: updated.height,
        data: updated.data,
        createdById: updated.createdById,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[moodboards/items] PATCH error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// DELETE: remove an item from the moodboard
// -----------------------------------------------------------------------------

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUserOrThrow();
    const { moodboardId, itemId } = await params;

    // Verify ownership chain: item -> moodboard -> company
    const item = await prisma.moodboardItem.findUnique({
      where: { id: itemId },
      include: {
        moodboard: {
          select: { id: true, ...MOODBOARD_ACCESS_SELECT },
        },
      },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (item.moodboardId !== moodboardId) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const access = moodboardAccess(user, item.moodboard);
    if (!access.canView) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    if (!access.canEdit) {
      return NextResponse.json(
        { error: "You don't have permission to change this moodboard" },
        { status: 403 },
      );
    }

    // Hidden, not removed, so undo can bring it back with its file.
    // purgeDeletedMoodboardItems removes it for good later.
    await prisma.moodboardItem.update({
      where: { id: itemId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[moodboards/items] DELETE error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
