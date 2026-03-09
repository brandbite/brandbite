// -----------------------------------------------------------------------------
// @file: app/api/customer/moodboards/[moodboardId]/route.ts
// @purpose: Single moodboard detail, update, and delete API
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-03-09
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { canManageMoodboards, isCompanyAdminRole } from "@/lib/permissions/companyRoles";
import { resolveAssetUrl } from "@/lib/r2";
import type { MoodboardItemType } from "@prisma/client";

type RouteParams = { params: Promise<{ moodboardId: string }> };

/** Regenerate presigned URLs for IMAGE and FILE items whose URLs have expired. */
async function refreshItemData(
  type: MoodboardItemType,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if ((type === "IMAGE" || type === "FILE") && typeof data.storageKey === "string") {
    const freshUrl = await resolveAssetUrl(data.storageKey, (data.url as string) ?? null);
    if (freshUrl) return { ...data, url: freshUrl };
  }
  return data;
}

// -----------------------------------------------------------------------------
// GET: full moodboard with all items
// -----------------------------------------------------------------------------

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUserOrThrow();
    if (user.role !== "CUSTOMER") {
      return NextResponse.json({ error: "Only customers can access moodboards" }, { status: 403 });
    }
    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "No active company" }, { status: 400 });
    }

    const { moodboardId } = await params;

    const moodboard = await prisma.moodboard.findUnique({
      where: { id: moodboardId },
      include: {
        project: { select: { id: true, name: true } },
        ticket: { select: { id: true, title: true } },
        items: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            type: true,
            position: true,
            colSpan: true,
            x: true,
            y: true,
            width: true,
            height: true,
            data: true,
            createdById: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!moodboard) {
      return NextResponse.json({ error: "Moodboard not found" }, { status: 404 });
    }

    // Verify company ownership
    if (moodboard.companyId !== user.activeCompanyId) {
      return NextResponse.json({ error: "Moodboard not found" }, { status: 404 });
    }

    // Refresh presigned URLs for IMAGE/FILE items in parallel
    const items = await Promise.all(
      moodboard.items.map(async (item) => ({
        id: item.id,
        type: item.type,
        position: item.position,
        colSpan: item.colSpan,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        data: await refreshItemData(item.type, item.data as Record<string, unknown>),
        createdById: item.createdById,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
    );

    return NextResponse.json({
      moodboard: {
        id: moodboard.id,
        title: moodboard.title,
        description: moodboard.description,
        companyId: moodboard.companyId,
        projectId: moodboard.project?.id ?? null,
        projectName: moodboard.project?.name ?? null,
        ticketId: moodboard.ticket?.id ?? null,
        ticketTitle: moodboard.ticket?.title ?? null,
        createdById: moodboard.createdById,
        items,
        connections: (moodboard.connections as unknown[]) ?? [],
        createdAt: moodboard.createdAt.toISOString(),
        updatedAt: moodboard.updatedAt.toISOString(),
      },
    });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[moodboards] GET error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// PATCH: update moodboard title / description
// -----------------------------------------------------------------------------

export async function PATCH(req: NextRequest, { params }: RouteParams) {
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
    const data: Record<string, unknown> = {};

    if (typeof raw.title === "string") {
      const title = raw.title.trim();
      if (!title) {
        return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
      }
      data.title = title;
    }

    if (raw.description !== undefined) {
      data.description =
        typeof raw.description === "string" ? raw.description.trim() || null : null;
    }

    if (Array.isArray(raw.connections)) {
      data.connections = raw.connections;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updated = await prisma.moodboard.update({
      where: { id: moodboardId },
      data,
      include: {
        project: { select: { id: true, name: true } },
        ticket: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json({
      moodboard: {
        id: updated.id,
        title: updated.title,
        description: updated.description,
        projectId: updated.project?.id ?? null,
        projectName: updated.project?.name ?? null,
        ticketId: updated.ticket?.id ?? null,
        ticketTitle: updated.ticket?.title ?? null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[moodboards] PATCH error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// -----------------------------------------------------------------------------
// DELETE: delete moodboard (cascade removes items)
// -----------------------------------------------------------------------------

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUserOrThrow();
    if (user.role !== "CUSTOMER") {
      return NextResponse.json({ error: "Only customers can access moodboards" }, { status: 403 });
    }
    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "No active company" }, { status: 400 });
    }

    const { moodboardId } = await params;

    const moodboard = await prisma.moodboard.findUnique({
      where: { id: moodboardId },
      select: { id: true, companyId: true, createdById: true },
    });

    if (!moodboard) {
      return NextResponse.json({ error: "Moodboard not found" }, { status: 404 });
    }

    if (moodboard.companyId !== user.activeCompanyId) {
      return NextResponse.json({ error: "Moodboard not found" }, { status: 404 });
    }

    // Only the creator or a company admin can delete
    const isCreator = moodboard.createdById === user.id;
    const isAdmin = isCompanyAdminRole(user.companyRole ?? null);

    if (!isCreator && !isAdmin) {
      return NextResponse.json(
        { error: "Only the creator or a company admin can delete this moodboard" },
        { status: 403 },
      );
    }

    await prisma.moodboard.delete({
      where: { id: moodboardId },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[moodboards] DELETE error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
