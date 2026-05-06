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

// Every status the queue surfaces in its filter chips. Originally this
// list lagged behind the schema (only the v1 statuses), causing any
// filter against a post-interview status — INTERVIEW_HELD, HIRED,
// ONBOARDED, REJECTED_AFTER_INTERVIEW — to silently fall back to "ALL".
// Keeping it in sync with the Prisma enum is now load-bearing for the
// filter UX.
const ALLOWED_STATUSES: TalentApplicationStatus[] = [
  "SUBMITTED",
  "IN_REVIEW",
  "AWAITING_CANDIDATE_CHOICE",
  "CANDIDATE_PROPOSED_TIME",
  "ACCEPTED",
  "INTERVIEW_HELD",
  "HIRED",
  "ONBOARDED",
  "DECLINED",
  "REJECTED_AFTER_INTERVIEW",
];

export type AdminTalentApplicationItem = TalentApplication & {
  /** PR5: true when this application's email matches an existing
   *  UserAccount (any role, including SITE_OWNER / SITE_ADMIN /
   *  CUSTOMER). Surfaced as a badge in the admin UI so the reviewer
   *  notices when an applicant has accidentally used their existing
   *  customer email. Set on the response, not persisted on the row. */
  existingCustomer: boolean;
};

export type AdminTalentApplicationListResponse = {
  applications: AdminTalentApplicationItem[];
  total: number;
  /** Echoed back so the client can render its filter chips with the same
   *  shape it sent. Saves a coordination round-trip after a status flip. */
  filter: {
    status: TalentApplicationStatus | "ALL";
  };
  /** Per-status counts across the entire table, regardless of the
   *  current filter. Powers the badge on each filter chip so the
   *  operator can see at a glance which buckets need attention without
   *  cycling through the dropdown. Zero values are included so the
   *  client doesn't need to defensively default missing keys. */
  counts: Record<TalentApplicationStatus, number>;
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

    // Three queries in parallel: the filtered page, the filtered total,
    // and the always-unfiltered per-status counts that drive the chip
    // badges. groupBy is index-aligned on (status) and the table caps in
    // the low hundreds for the foreseeable future, so this is cheap.
    const [applications, total, statusCounts] = await Promise.all([
      prisma.talentApplication.findMany({
        where,
        // Newest first within each status grouping. Matches the index.
        orderBy: [{ createdAt: "desc" }],
        take: limit,
        skip: offset,
      }),
      prisma.talentApplication.count({ where }),
      prisma.talentApplication.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ]);

    // Hydrate every status key with 0 so the client doesn't need to
    // defensively default missing keys. Mirrors the order of the
    // ALLOWED_STATUSES constant above.
    const counts = ALLOWED_STATUSES.reduce(
      (acc, s) => {
        acc[s] = 0;
        return acc;
      },
      {} as Record<TalentApplicationStatus, number>,
    );
    for (const row of statusCounts) {
      counts[row.status] = row._count._all;
    }

    // PR5 — email-collision flag. Single batched lookup against UserAccount
    // (indexed on `email @unique`) rather than N per-row queries, so adding
    // this enrichment to the list view is one extra DB roundtrip regardless
    // of page size. Skip the lookup entirely on an empty page.
    const applicantEmails = applications.map((a) => a.email);
    const customerSet = new Set<string>();
    if (applicantEmails.length > 0) {
      const customers = await prisma.userAccount.findMany({
        where: { email: { in: applicantEmails }, deletedAt: null },
        select: { email: true },
      });
      for (const c of customers) customerSet.add(c.email);
    }

    const enriched: AdminTalentApplicationItem[] = applications.map((a) => ({
      ...a,
      existingCustomer: customerSet.has(a.email),
    }));

    const body: AdminTalentApplicationListResponse = {
      applications: enriched,
      total,
      filter: { status },
      counts,
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
