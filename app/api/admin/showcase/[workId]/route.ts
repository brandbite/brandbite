// -----------------------------------------------------------------------------
// @file: app/api/admin/showcase/[workId]/route.ts
// @purpose: Admin — update or delete a single showcase work
// @version: v0.1.0
// @status: active
// @lastUpdate: 2026-02-23
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";

// ---------------------------------------------------------------------------
// PATCH — update a showcase work
// ---------------------------------------------------------------------------

export async function PATCH(req: Request, { params }: { params: Promise<{ workId: string }> }) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const { workId } = await params;
    const body = (await req.json()) as any;

    // If status is being changed to PUBLISHED and publishedAt is not already set,
    // auto-set publishedAt to now
    if (body?.status === "PUBLISHED") {
      const existing = await prisma.showcaseWork.findUnique({
        where: { id: workId },
        select: { publishedAt: true },
      });

      if (!existing) {
        return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
      }

      if (!existing.publishedAt) {
        body.publishedAt = new Date();
      }
    }

    const work = await prisma.showcaseWork.update({
      where: { id: workId },
      data: body,
    });

    return NextResponse.json({ work });
  } catch (err: any) {
    const code = err?.code ?? "UNKNOWN";

    if (code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }

    // Prisma P2025 = record not found
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    console.error("[admin/showcase/[workId]] PATCH error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE — remove a showcase work
// ---------------------------------------------------------------------------

export async function DELETE(_req: Request, { params }: { params: Promise<{ workId: string }> }) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const { workId } = await params;

    await prisma.showcaseWork.delete({
      where: { id: workId },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    const code = err?.code ?? "UNKNOWN";

    if (code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }

    if (err?.code === "P2025") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    console.error("[admin/showcase/[workId]] DELETE error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
