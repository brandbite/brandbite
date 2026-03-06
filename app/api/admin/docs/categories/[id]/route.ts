// -----------------------------------------------------------------------------
// @file: app/api/admin/docs/categories/[id]/route.ts
// @purpose: Admin — update or delete a single doc category
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";

// ---------------------------------------------------------------------------
// PATCH — update a doc category
// ---------------------------------------------------------------------------

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const { id } = await params;
    const body = (await req.json()) as any;

    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (body.icon !== undefined) data.icon = body.icon;
    if (body.audience !== undefined) data.audience = body.audience;
    if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;

    const category = await prisma.docCategory.update({
      where: { id },
      data,
    });

    return NextResponse.json({ category });
  } catch (err: any) {
    const code = err?.code ?? "UNKNOWN";

    if (code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }

    if (err?.code === "P2025") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    console.error("[admin/docs/categories/[id]] PATCH error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE — remove a doc category (blocked if articles exist)
// ---------------------------------------------------------------------------

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const { id } = await params;

    const count = await prisma.docArticle.count({ where: { categoryId: id } });
    if (count > 0) {
      return NextResponse.json(
        {
          error: "CATEGORY_HAS_ARTICLES",
          message: "Cannot delete category with existing articles. Move or delete articles first.",
        },
        { status: 409 },
      );
    }

    await prisma.docCategory.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    const code = err?.code ?? "UNKNOWN";

    if (code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }

    if (err?.code === "P2025") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    console.error("[admin/docs/categories/[id]] DELETE error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
