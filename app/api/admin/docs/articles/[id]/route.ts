// -----------------------------------------------------------------------------
// @file: app/api/admin/docs/articles/[id]/route.ts
// @purpose: Admin — update or delete a single doc article
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";

// ---------------------------------------------------------------------------
// PATCH — update a doc article
// ---------------------------------------------------------------------------

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const { id } = await params;
    const body = (await req.json()) as any;

    if (body?.status === "PUBLISHED") {
      const existing = await prisma.docArticle.findUnique({
        where: { id },
        select: { publishedAt: true },
      });

      if (!existing) {
        return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
      }

      if (!existing.publishedAt) {
        body.publishedAt = new Date();
      }
    }

    const article = await prisma.docArticle.update({
      where: { id },
      data: body,
    });

    return NextResponse.json({ article });
  } catch (err: any) {
    const code = err?.code ?? "UNKNOWN";

    if (code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }

    if (err?.code === "P2025") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    console.error("[admin/docs/articles/[id]] PATCH error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE — remove a doc article
// ---------------------------------------------------------------------------

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const { id } = await params;

    await prisma.docArticle.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    const code = err?.code ?? "UNKNOWN";

    if (code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }

    if (err?.code === "P2025") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    console.error("[admin/docs/articles/[id]] DELETE error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
