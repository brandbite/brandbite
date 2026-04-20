// -----------------------------------------------------------------------------
// @file: app/api/admin/time-tracking/route.ts
// @purpose: Admin time-tracking rollup. Lists tickets that have at least
//           one time entry, joined with their job type's estimatedHours so
//           ops can see which tickets are overrunning or under-running the
//           expected effort and feed that back into token pricing.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-04-20
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";
import { buildTicketCode } from "@/lib/ticket-code";

const MAX_ROWS = 200;

export type AdminTimeTrackingRow = {
  ticketId: string;
  code: string;
  title: string;
  status: string;
  creative: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  company: {
    id: string;
    name: string;
  } | null;
  jobType: {
    id: string;
    name: string;
    estimatedHours: number | null;
    tokenCost: number;
  } | null;
  loggedSeconds: number;
  loggedHours: number;
  estimatedHours: number | null;
  /**
   * Ratio of logged / estimated. `null` if there's no estimate to compare
   * against, so the UI can show an em-dash.
   */
  estimateRatio: number | null;
  /** Number of time entries (running + stopped). */
  entryCount: number;
  /** True if at least one entry is currently running. */
  hasRunningEntry: boolean;
  completedAt: string | null;
};

export type AdminTimeTrackingResponse = {
  rows: AdminTimeTrackingRow[];
  stats: {
    ticketCount: number;
    totalLoggedHours: number;
    totalEstimatedHours: number;
    overrunCount: number; // rows where ratio > 1
  };
  /**
   * True when the TicketTimeEntry table itself is missing from the
   * current DB — i.e. the D7 migration hasn't been run yet against this
   * environment. The admin page renders a "migration pending" note
   * instead of a generic error.
   */
  migrationPending?: boolean;
};

/** Empty payload shared between the "no entries yet" and "table missing"
 *  paths so the admin page handles both with a single empty-state render. */
function emptyResponse(migrationPending = false): AdminTimeTrackingResponse {
  return {
    rows: [],
    stats: {
      ticketCount: 0,
      totalLoggedHours: 0,
      totalEstimatedHours: 0,
      overrunCount: 0,
    },
    ...(migrationPending ? { migrationPending: true } : {}),
  };
}

/** Prisma raises P2021 "The table does not exist in the current database"
 *  when a model referenced in code has no matching table. That happens on
 *  demo/staging DBs where `prisma migrate deploy` hasn't caught up yet. */
function isMissingTableError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021";
}

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json(
        { error: "Only site admins can view time-tracking analytics." },
        { status: 403 },
      );
    }

    // Aggregate time per ticket. groupBy + take forces us to do this in two
    // steps, but the set is bounded at MAX_ROWS so it stays cheap.
    const aggregates = await prisma.ticketTimeEntry
      .groupBy({
        by: ["ticketId"],
        _sum: { durationSeconds: true },
        _count: { _all: true },
        orderBy: { _sum: { durationSeconds: "desc" } },
        take: MAX_ROWS,
      })
      .catch((err: unknown) => {
        if (isMissingTableError(err)) return "MISSING_TABLE" as const;
        throw err;
      });

    if (aggregates === "MISSING_TABLE") {
      // Migration hasn't run yet — return the empty-state payload with a
      // hint so the page can surface it to the admin rather than showing
      // a generic red "Failed to load" banner.
      return NextResponse.json(emptyResponse(true), { status: 200 });
    }

    if (aggregates.length === 0) {
      return NextResponse.json(emptyResponse(), { status: 200 });
    }

    const ticketIds = aggregates.map((a) => a.ticketId);

    const [tickets, runningEntries] = await Promise.all([
      prisma.ticket.findMany({
        where: { id: { in: ticketIds } },
        select: {
          id: true,
          title: true,
          status: true,
          companyTicketNumber: true,
          completedAt: true,
          quantity: true,
          creative: { select: { id: true, name: true, email: true } },
          company: { select: { id: true, name: true } },
          project: { select: { code: true } },
          jobType: {
            select: { id: true, name: true, estimatedHours: true, tokenCost: true },
          },
        },
      }),
      // Per-ticket count of still-running entries
      prisma.ticketTimeEntry.findMany({
        where: { ticketId: { in: ticketIds }, endedAt: null },
        select: { ticketId: true },
      }),
    ]);

    const ticketById = new Map(tickets.map((t) => [t.id, t]));
    const runningByTicket = new Set(runningEntries.map((r) => r.ticketId));

    let totalLoggedSeconds = 0;
    let totalEstimatedSeconds = 0;
    let overrunCount = 0;

    const rows: AdminTimeTrackingRow[] = aggregates.flatMap((a) => {
      const ticket = ticketById.get(a.ticketId);
      if (!ticket) return [];

      const loggedSeconds = a._sum.durationSeconds ?? 0;
      const loggedHours = loggedSeconds / 3600;

      // Estimated scales by quantity so a "logo × 3" ticket has 3× the expectation.
      const perUnitEstimate = ticket.jobType?.estimatedHours ?? null;
      const qty = ticket.quantity ?? 1;
      const estimatedHours =
        perUnitEstimate != null && perUnitEstimate > 0 ? perUnitEstimate * qty : null;

      const estimateRatio =
        estimatedHours != null && estimatedHours > 0 ? loggedHours / estimatedHours : null;

      totalLoggedSeconds += loggedSeconds;
      if (estimatedHours != null) totalEstimatedSeconds += estimatedHours * 3600;
      if (estimateRatio != null && estimateRatio > 1) overrunCount += 1;

      return [
        {
          ticketId: ticket.id,
          code: buildTicketCode({
            projectCode: ticket.project?.code ?? null,
            companyTicketNumber: ticket.companyTicketNumber,
            ticketId: ticket.id,
          }),
          title: ticket.title,
          status: ticket.status,
          creative: ticket.creative,
          company: ticket.company,
          jobType: ticket.jobType,
          loggedSeconds,
          loggedHours,
          estimatedHours,
          estimateRatio,
          entryCount: a._count._all,
          hasRunningEntry: runningByTicket.has(ticket.id),
          completedAt: ticket.completedAt ? ticket.completedAt.toISOString() : null,
        },
      ];
    });

    const body: AdminTimeTrackingResponse = {
      rows,
      stats: {
        ticketCount: rows.length,
        totalLoggedHours: totalLoggedSeconds / 3600,
        totalEstimatedHours: totalEstimatedSeconds / 3600,
        overrunCount,
      },
    };

    return NextResponse.json(body, { status: 200 });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[GET /api/admin/time-tracking] error", error);
    return NextResponse.json({ error: "Failed to load time-tracking analytics" }, { status: 500 });
  }
}
