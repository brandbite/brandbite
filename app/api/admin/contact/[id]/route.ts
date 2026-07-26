// -----------------------------------------------------------------------------
// @file: app/api/admin/contact/[id]/route.ts
// @purpose: Update or delete a contact message from the /admin/contact
//           inbox. PATCH sets status (NEW/READ/ARCHIVED); DELETE is for
//           spam only (real messages should be ARCHIVED, not erased).
//
//           Auth: SITE_ADMIN+ for PATCH, SITE_OWNER for DELETE — same
//           split as the feedback queue.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import type { ContactMessageStatus } from "@prisma/client";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSiteAdminRole, isSiteOwnerRole } from "@/lib/roles";

export const runtime = "nodejs";

const STATUSES: ContactMessageStatus[] = ["NEW", "READ", "ARCHIVED"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserOrThrow();
    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const body = (await req.json().catch(() => null)) as { status?: unknown } | null;
    if (!body || typeof body.status !== "string" || !(STATUSES as string[]).includes(body.status)) {
      return NextResponse.json(
        { error: `status must be one of: ${STATUSES.join(", ")}` },
        { status: 400 },
      );
    }

    const updated = await prisma.contactMessage.update({
      where: { id },
      data: { status: body.status as ContactMessageStatus },
      select: { id: true, status: true, updatedAt: true },
    });

    return NextResponse.json({
      contactMessage: { ...updated, updatedAt: updated.updatedAt.toISOString() },
    });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if ((err as { code?: string })?.code === "P2025") {
      return NextResponse.json({ error: "Message not found." }, { status: 404 });
    }
    console.error("[PATCH /api/admin/contact/[id]] error", err);
    return NextResponse.json({ error: "Failed to update message." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserOrThrow();
    // DELETE is for spam — SITE_OWNER only, so a real inquiry can't be
    // quietly erased by an admin who just doesn't want to archive it.
    if (!isSiteOwnerRole(user.role)) {
      return NextResponse.json(
        { error: "Only site owners can delete messages. Archive instead." },
        { status: 403 },
      );
    }

    const { id } = await params;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    await prisma.contactMessage.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if ((err as { code?: string })?.code === "P2025") {
      return NextResponse.json({ error: "Message not found." }, { status: 404 });
    }
    console.error("[DELETE /api/admin/contact/[id]] error", err);
    return NextResponse.json({ error: "Failed to delete message." }, { status: 500 });
  }
}
