// -----------------------------------------------------------------------------
// @file: app/api/admin/faq/[id]/route.ts
// @purpose: Admin update + delete for a single Faq row. Same SITE_ADMIN gate
//           and cache-busting as the collection-root POST.
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/schemas/helpers";
import { updateFaqSchema } from "@/lib/schemas/faq.schemas";
import { bustFaqCaches } from "@/lib/faq/revalidate";

// ---------------------------------------------------------------------------
// PATCH — update the rows fields admins can change. Any subset of the
// allowed fields is fine; omitted fields stay as-is.
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserOrThrow();
    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
    }

    const parsed = await parseBody(req, updateFaqSchema);
    if (!parsed.success) return parsed.response;

    // Build a sparse update payload — only set columns the caller
    // explicitly provided. Spreading a partial object directly into
    // prisma.update would set undefined keys to null on some setups,
    // so we walk the keys deliberately.
    const data: Record<string, unknown> = {};
    if (parsed.data.question !== undefined) data.question = parsed.data.question;
    if (parsed.data.answer !== undefined) data.answer = parsed.data.answer;
    if (parsed.data.category !== undefined) data.category = parsed.data.category;
    if (parsed.data.position !== undefined) data.position = parsed.data.position;
    if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "BAD_REQUEST", reason: "no fields to update" },
        {
          status: 400,
        },
      );
    }

    const updated = await prisma.faq.update({
      where: { id },
      data,
      select: { id: true },
    });

    console.log("[admin/faq] updated", {
      actor: user.email,
      role: user.role,
      faqId: updated.id,
      changedFields: Object.keys(data),
    });

    bustFaqCaches();

    return NextResponse.json({ id: updated.id });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (code === "P2025") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    console.error("[admin/faq/[id]] PATCH error", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE — hard delete a row. Soft-delete via isActive=false is also
// available; the form uses the toggle for "hide from public" and DELETE
// for "remove permanently."
// ---------------------------------------------------------------------------

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserOrThrow();
    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
    }

    await prisma.faq.delete({ where: { id } });

    console.log("[admin/faq] deleted", {
      actor: user.email,
      role: user.role,
      faqId: id,
    });

    bustFaqCaches();

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (code === "P2025") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    console.error("[admin/faq/[id]] DELETE error", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
