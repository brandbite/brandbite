// -----------------------------------------------------------------------------
// @file: app/api/admin/feedback/[id]/route.ts
// @purpose: Update or delete a feedback row from the /admin/feedback triage
//           page. PATCH accepts status + adminNotes; DELETE is for spam /
//           junk only (real feedback should be marked WONT_DO with a note,
//           not erased).
//
//           Auth: SITE_ADMIN+ for PATCH, SITE_OWNER for DELETE so the
//           hard-erase requires the higher gate.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import type { FeedbackStatus } from "@prisma/client";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSiteAdminRole, isSiteOwnerRole } from "@/lib/roles";

export const runtime = "nodejs";

const STATUSES: FeedbackStatus[] = ["NEW", "TRIAGED", "PLANNED", "DONE", "WONT_DO"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserOrThrow();
    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const body = (await req.json().catch(() => null)) as {
      status?: unknown;
      adminNotes?: unknown;
    } | null;
    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const data: { status?: FeedbackStatus; adminNotes?: string | null } = {};

    if (body.status !== undefined) {
      if (typeof body.status !== "string" || !(STATUSES as string[]).includes(body.status)) {
        return NextResponse.json(
          { error: `status must be one of: ${STATUSES.join(", ")}` },
          { status: 400 },
        );
      }
      data.status = body.status as FeedbackStatus;
    }

    if (body.adminNotes !== undefined) {
      if (body.adminNotes === null || body.adminNotes === "") {
        data.adminNotes = null;
      } else if (typeof body.adminNotes !== "string") {
        return NextResponse.json({ error: "adminNotes must be a string or null" }, { status: 400 });
      } else {
        const trimmed = body.adminNotes.trim();
        if (trimmed.length > 4000) {
          return NextResponse.json(
            { error: "Admin notes must be 4000 characters or fewer." },
            { status: 400 },
          );
        }
        data.adminNotes = trimmed.length === 0 ? null : trimmed;
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const updated = await prisma.feedback.update({
      where: { id },
      data,
      select: { id: true, status: true, adminNotes: true, updatedAt: true },
    });

    return NextResponse.json({
      feedback: { ...updated, updatedAt: updated.updatedAt.toISOString() },
    });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if ((err as { code?: string })?.code === "P2025") {
      return NextResponse.json({ error: "Feedback not found." }, { status: 404 });
    }
    console.error("[PATCH /api/admin/feedback/[id]] error", err);
    return NextResponse.json({ error: "Failed to update feedback." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserOrThrow();
    // DELETE is for spam / junk — keep it gated to SITE_OWNER so real
    // feedback can't be quietly erased by an admin who just doesn't
    // want to mark it WONT_DO.
    if (!isSiteOwnerRole(user.role)) {
      return NextResponse.json(
        { error: "Only site owners can delete feedback. Mark as WONT_DO instead." },
        { status: 403 },
      );
    }

    const { id } = await params;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    await prisma.feedback.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if ((err as { code?: string })?.code === "P2025") {
      return NextResponse.json({ error: "Feedback not found." }, { status: 404 });
    }
    console.error("[DELETE /api/admin/feedback/[id]] error", err);
    return NextResponse.json({ error: "Failed to delete feedback." }, { status: 500 });
  }
}
