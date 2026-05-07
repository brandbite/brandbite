// -----------------------------------------------------------------------------
// @file: app/api/admin/feedback/route.ts
// @purpose: Admin-side list of feedback submissions for the /admin/feedback
//           triage page. Filterable by type and status; ordered by recency
//           with NEW entries first via a (status, createdAt DESC) index.
//
//           Auth: SITE_ADMIN+ (matches every other admin list endpoint).
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import type { FeedbackStatus, FeedbackType, Prisma } from "@prisma/client";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSiteAdminRole } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: FeedbackType[] = ["BUG", "FEATURE", "PRAISE", "QUESTION"];
const STATUSES: FeedbackStatus[] = ["NEW", "TRIAGED", "PLANNED", "DONE", "WONT_DO"];

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const typeRaw = searchParams.get("type");
    const statusRaw = searchParams.get("status");
    const limitRaw = searchParams.get("limit");

    const where: Prisma.FeedbackWhereInput = {};
    if (typeRaw && (TYPES as string[]).includes(typeRaw)) {
      where.type = typeRaw as FeedbackType;
    }
    if (statusRaw && (STATUSES as string[]).includes(statusRaw)) {
      where.status = statusRaw as FeedbackStatus;
    }

    const limit = Math.max(1, Math.min(200, Number.parseInt(limitRaw ?? "100", 10) || 100));

    // Two queries in parallel: the page itself + per-status counts so the
    // chip filter on the page can show "(N)" without a follow-up fetch.
    const [items, statusCounts] = await Promise.all([
      prisma.feedback.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        take: limit,
        select: {
          id: true,
          type: true,
          status: true,
          subject: true,
          message: true,
          pageUrl: true,
          userAgent: true,
          viewport: true,
          submittedById: true,
          submittedByEmail: true,
          submittedByRole: true,
          adminNotes: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.feedback.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ]);

    const counts = STATUSES.reduce(
      (acc, s) => {
        acc[s] = 0;
        return acc;
      },
      {} as Record<FeedbackStatus, number>,
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
    console.error("[GET /api/admin/feedback] error", err);
    return NextResponse.json({ error: "Failed to load feedback." }, { status: 500 });
  }
}
