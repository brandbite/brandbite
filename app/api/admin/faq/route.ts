// -----------------------------------------------------------------------------
// @file: app/api/admin/faq/route.ts
// @purpose: Admin endpoints for the central Faq table. List + create live
//           on the collection root; update + delete live on /[id]/route.ts.
//
//           SITE_ADMIN gate: any admin can manage FAQs (matches /admin/blog,
//           /admin/showcase, /admin/docs). The page-block FAQ picker on
//           /admin/landing stays SITE_OWNER-only — that's a separate gate
//           on the page-blocks endpoint.
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { parseBody } from "@/lib/schemas/helpers";
import { createFaqSchema } from "@/lib/schemas/faq.schemas";
import { bustFaqCaches } from "@/lib/faq/revalidate";

// ---------------------------------------------------------------------------
// GET — list all FAQs (active + inactive). Used by the admin /admin/faq
// list page; the public /api/faq endpoint filters to active-only.
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();
    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const rows = await prisma.faq.findMany({
      orderBy: [{ category: "asc" }, { position: "asc" }],
      select: {
        id: true,
        question: true,
        answer: true,
        category: true,
        position: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Distinct category list, derived from rows. Useful for the form's
    // category dropdown so admins can either pick an existing one or
    // type a new one.
    const categories: string[] = [];
    for (const row of rows) {
      if (!categories.includes(row.category)) categories.push(row.category);
    }

    return NextResponse.json({
      faqs: rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
      categories,
    });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[admin/faq] GET error", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — create a new FAQ. If position is omitted, lands at the end of
// its category bucket so admins don't need to look up the next position.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const parsed = await parseBody(req, createFaqSchema);
    if (!parsed.success) return parsed.response;

    let position = parsed.data.position;
    if (position === undefined) {
      const tail = await prisma.faq.findFirst({
        where: { category: parsed.data.category },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      position = tail ? tail.position + 1 : 0;
    }

    const created = await prisma.faq.create({
      data: {
        question: parsed.data.question,
        answer: parsed.data.answer,
        category: parsed.data.category,
        position,
        isActive: parsed.data.isActive,
      },
      select: { id: true },
    });

    // Forensic trail until we add FAQ_* values to AdminActionType (follow-up).
    console.log("[admin/faq] created", {
      actor: user.email,
      role: user.role,
      faqId: created.id,
      category: parsed.data.category,
    });

    bustFaqCaches();

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[admin/faq] POST error", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
