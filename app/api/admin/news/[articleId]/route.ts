// -----------------------------------------------------------------------------
// @file: app/api/admin/news/[articleId]/route.ts
// @purpose: Admin — update or delete a single news article
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";

// ---------------------------------------------------------------------------
// PATCH — update a news article
// ---------------------------------------------------------------------------

export async function PATCH(req: Request, { params }: { params: Promise<{ articleId: string }> }) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const { articleId } = await params;
    const body = (await req.json()) as any;

    if (body?.status === "PUBLISHED") {
      const existing = await prisma.newsArticle.findUnique({
        where: { id: articleId },
        select: { publishedAt: true },
      });

      if (!existing) {
        return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
      }

      if (!existing.publishedAt) {
        body.publishedAt = new Date();
      }
    }

    const article = await prisma.newsArticle.update({
      where: { id: articleId },
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

    console.error("[admin/news/[articleId]] PATCH error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE — remove a news article
// ---------------------------------------------------------------------------

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ articleId: string }> },
) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const { articleId } = await params;

    await prisma.newsArticle.delete({
      where: { id: articleId },
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

    console.error("[admin/news/[articleId]] DELETE error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
