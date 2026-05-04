// -----------------------------------------------------------------------------
// @file: app/api/admin/talent-applications/route.ts
// @purpose: Admin list endpoint for the talent-application queue. SITE_OWNER
//           only — gated by canManageTalentApplications. Returns the full
//           submission payload (every field on the row) because the admin
//           detail panel reads from the same response without a follow-up
//           fetch. Pagination is offset-based, default limit 50; the queue
//           realistically caps in the low hundreds for the foreseeable
//           future, so cursors aren't worth the complexity yet.
//
//           The PATCH (accept / decline) lives at
//           app/api/admin/talent-applications/[id]/route.ts so the URL shape
//           matches /admin/{plans,users,etc.} elsewhere in the codebase.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import type { TalentApplication, TalentApplicationStatus } from "@prisma/client";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageTalentApplications } from "@/lib/roles";

export const runtime = "nodejs";
// Always render server-side, no static cache. The list mutates whenever a
// new application lands or an admin acts on one; even a 1-min cache would
// noticeably stale-out the queue.
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const ALLOWED_STATUSES: TalentApplicationStatus[] = [
  "SUBMITTED",
  "IN_REVIEW",
  "ACCEPTED",
  "DECLINED",
];

export type AdminTalentApplicationItem = TalentApplication;

export type AdminTalentApplicationListResponse = {
  applications: AdminTalentApplicationItem[];
  total: number;
  /** Echoed back so the client can render its filter chips with the same
   *  shape it sent. Saves a coordination round-trip after a status flip. */
  filter: {
    status: TalentApplicationStatus | "ALL";
  };
};

function parseStatus(raw: string | null): TalentApplicationStatus | "ALL" {
  if (!raw) return "ALL";
  const upper = raw.toUpperCase();
  if (upper === "ALL") return "ALL";
  if ((ALLOWED_STATUSES as string[]).includes(upper)) {
    return upper as TalentApplicationStatus;
  }
  return "ALL";
}

function parseLimit(raw: string | null): number {
  if (!raw) return DEFAULT_LIMIT;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function parseOffset(raw: string | null): number {
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    if (!canManageTalentApplications(user.role)) {
      return NextResponse.json(
        { error: "Only the site owner can review talent applications." },
        { status: 403 },
      );
    }

    const url = new URL(req.url);
    const status = parseStatus(url.searchParams.get("status"));
    const limit = parseLimit(url.searchParams.get("limit"));
    const offset = parseOffset(url.searchParams.get("offset"));

    const where = status === "ALL" ? {} : { status };

    // Two queries are cheaper than a single findMany + manual count when
    // the filter is index-aligned (status + createdAt is the primary
    // index). Run them in parallel.
    const [applications, total] = await Promise.all([
      prisma.talentApplication.findMany({
        where,
        // Newest first within each status grouping. Matches the index.
        orderBy: [{ createdAt: "desc" }],
        take: limit,
        skip: offset,
      }),
      prisma.talentApplication.count({ where }),
    ]);

    const body: AdminTalentApplicationListResponse = {
      applications,
      total,
      filter: { status },
    };

    return NextResponse.json(body, { status: 200 });
  } catch (err) {
    if ((err as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[api/admin/talent-applications] GET error", err);
    return NextResponse.json({ error: "Failed to load talent applications." }, { status: 500 });
  }
}
