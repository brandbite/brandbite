// -----------------------------------------------------------------------------
// @file: app/api/admin/contact/route.ts
// @purpose: Admin-side list of public contact-form messages for the
//           /admin/contact inbox. Filterable by status; ordered by recency.
//           Mirrors /api/admin/feedback.
//
//           Auth: SITE_ADMIN+ (matches every other admin list endpoint).
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import type { ContactMessageStatus, Prisma } from "@prisma/client";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSiteAdminRole } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: ContactMessageStatus[] = ["NEW", "READ", "ARCHIVED"];

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const statusRaw = searchParams.get("status");
    const limitRaw = searchParams.get("limit");

    const where: Prisma.ContactMessageWhereInput = {};
    if (statusRaw && (STATUSES as string[]).includes(statusRaw)) {
      where.status = statusRaw as ContactMessageStatus;
    }

    const limit = Math.max(1, Math.min(200, Number.parseInt(limitRaw ?? "100", 10) || 100));

    // Page + per-status counts in parallel so the filter chips can show
    // "(N)" without a follow-up fetch.
    const [items, statusCounts] = await Promise.all([
      prisma.contactMessage.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          company: true,
          topic: true,
          message: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.contactMessage.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ]);

    const counts = STATUSES.reduce(
      (acc, s) => {
        acc[s] = 0;
        return acc;
      },
      {} as Record<ContactMessageStatus, number>,
    );
    for (const row of statusCounts) counts[row.status] = row._count._all;

    return NextResponse.json({
      items: items.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      counts,
    });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[GET /api/admin/contact] error", err);
    return NextResponse.json({ error: "Failed to load contact messages." }, { status: 500 });
  }
}
