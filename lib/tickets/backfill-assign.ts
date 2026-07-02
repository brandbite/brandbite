// -----------------------------------------------------------------------------
// @file: lib/tickets/backfill-assign.ts
// @purpose: Admin-triggered re-run of auto-assign across tickets that were left
//           unassigned (e.g. created before a company turned auto-assign on).
//
// This mirrors the assignment pipeline inside lib/tickets/create-ticket.ts
// (skill filter → pause filter → tasksPerWeekCap filter → lowest-load →
// rating tie-break). It intentionally reuses the SAME pure helpers so the two
// paths can't silently diverge. If you change the selection rules in
// create-ticket.ts, mirror them here.
//
// Scope guardrails:
//   - Only TODO, currently-unassigned, non-AI tickets are candidates.
//   - A ticket is only assigned when auto-assign is effectively enabled for it
//     (company default composed with the project's AutoAssignMode) — so this
//     never overrides an intentional "auto-assign off" project.
//   - Status is left at TODO and only creativeId is set, exactly like the
//     create path does for a freshly auto-assigned non-AI ticket.
// -----------------------------------------------------------------------------

import { AutoAssignMode, TicketPriority, TicketStatus, UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isCreativePaused } from "@/lib/creative-availability";
import { getCreativeRatingSummaries } from "@/lib/ratings/creative-ratings";
import { isAutoAssignEnabled, selectCreativeByLoadThenRating } from "@/lib/tickets/auto-assign";

const MAX_TICKETS_PER_RUN = 500;

export type BackfillSkipReason =
  | "auto_assign_disabled"
  | "no_skilled_creatives"
  | "all_skilled_paused_or_capped"
  | "no_job_type";

export type BackfillResult = {
  scanned: number;
  assigned: number;
  skipped: number;
  skippedByReason: Record<BackfillSkipReason, number>;
  hasMore: boolean;
};

const PRIORITY_WEIGHTS: Record<TicketPriority, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
};

/**
 * Re-run auto-assign for currently-unassigned TODO tickets.
 *
 * @param companyId  Optional — restrict the sweep to one company. Omit to run
 *                   across every company.
 */
export async function backfillAutoAssign(companyId?: string): Promise<BackfillResult> {
  const skippedByReason: Record<BackfillSkipReason, number> = {
    auto_assign_disabled: 0,
    no_skilled_creatives: 0,
    all_skilled_paused_or_capped: 0,
    no_job_type: 0,
  };

  const candidates = await prisma.ticket.findMany({
    where: {
      status: TicketStatus.TODO,
      creativeId: null,
      creativeMode: { not: "AI" },
      ...(companyId ? { companyId } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: MAX_TICKETS_PER_RUN + 1,
    select: {
      id: true,
      companyId: true,
      jobTypeId: true,
      company: { select: { autoAssignDefaultEnabled: true } },
      project: { select: { autoAssignMode: true } },
    },
  });

  const hasMore = candidates.length > MAX_TICKETS_PER_RUN;
  const batch = candidates.slice(0, MAX_TICKETS_PER_RUN);

  let assigned = 0;
  let skipped = 0;

  for (const ticket of batch) {
    const effective = isAutoAssignEnabled(
      ticket.company?.autoAssignDefaultEnabled ?? false,
      (ticket.project?.autoAssignMode as AutoAssignMode | null) ?? null,
    );
    if (!effective) {
      skipped++;
      skippedByReason.auto_assign_disabled++;
      continue;
    }

    if (!ticket.jobTypeId) {
      skipped++;
      skippedByReason.no_job_type++;
      continue;
    }

    const creativeId = await resolveCreative(ticket.jobTypeId);
    if (!creativeId) {
      skipped++;
      // Distinguish "nobody has this skill" from "everyone's paused/at cap".
      const skilledExists =
        (await prisma.creativeSkill.count({ where: { jobTypeId: ticket.jobTypeId } })) > 0;
      if (skilledExists) skippedByReason.all_skilled_paused_or_capped++;
      else skippedByReason.no_skilled_creatives++;
      continue;
    }

    // Assign + log atomically. Status stays TODO (matches create-ticket).
    await prisma.$transaction(async (tx) => {
      // Guard against a concurrent claim: only assign if still unassigned.
      const claimed = await tx.ticket.updateMany({
        where: { id: ticket.id, creativeId: null, status: TicketStatus.TODO },
        data: { creativeId },
      });
      if (claimed.count === 0) return;

      await tx.ticketAssignmentLog.create({
        data: {
          ticketId: ticket.id,
          creativeId,
          reason: "AUTO_ASSIGN",
          metadata: {
            algorithm: "v4-skill-weighted-cap-aware",
            source: "admin-backfill",
            jobTypeId: ticket.jobTypeId,
          },
        },
      });
    });

    assigned++;
  }

  return {
    scanned: batch.length,
    assigned,
    skipped,
    skippedByReason,
    hasMore,
  };
}

/**
 * Pick a creative for a single job type using the same pipeline as
 * create-ticket.ts. Returns null when no eligible creative exists.
 */
async function resolveCreative(jobTypeId: string): Promise<string | null> {
  const skilled = await prisma.creativeSkill.findMany({
    where: { jobTypeId },
    select: { creativeId: true },
  });
  let candidateIds = skilled.map((s) => s.creativeId);
  if (candidateIds.length === 0) return null;

  // Pause filter.
  const states = await prisma.userAccount.findMany({
    where: { id: { in: candidateIds }, role: UserRole.DESIGNER },
    select: { id: true, isPaused: true, pauseExpiresAt: true, tasksPerWeekCap: true },
  });
  const stateById = new Map(states.map((s) => [s.id, s]));
  candidateIds = candidateIds.filter((id) => {
    const s = stateById.get(id);
    return s ? !isCreativePaused(s) : false;
  });
  if (candidateIds.length === 0) return null;

  // Load + open-count per creative (drives cap filter + lowest-load pick).
  const openTickets = await prisma.ticket.findMany({
    where: {
      creativeId: { in: candidateIds },
      status: { in: [TicketStatus.TODO, TicketStatus.IN_PROGRESS, TicketStatus.IN_REVIEW] },
    },
    select: {
      creativeId: true,
      priority: true,
      quantity: true,
      jobType: { select: { tokenCost: true } },
    },
  });

  const loadByCreative = new Map<string, number>();
  const openCountByCreative = new Map<string, number>();
  for (const id of candidateIds) {
    loadByCreative.set(id, 0);
    openCountByCreative.set(id, 0);
  }
  for (const t of openTickets) {
    if (!t.creativeId || !loadByCreative.has(t.creativeId)) continue;
    const weight = PRIORITY_WEIGHTS[t.priority as TicketPriority];
    const cost = (t.jobType?.tokenCost ?? 1) * (t.quantity ?? 1);
    loadByCreative.set(t.creativeId, (loadByCreative.get(t.creativeId) ?? 0) + weight * cost);
    openCountByCreative.set(t.creativeId, (openCountByCreative.get(t.creativeId) ?? 0) + 1);
  }

  // tasksPerWeekCap filter (null cap = unlimited).
  candidateIds = candidateIds.filter((id) => {
    const cap = stateById.get(id)?.tasksPerWeekCap;
    if (cap == null) return true;
    return (openCountByCreative.get(id) ?? 0) < cap;
  });
  if (candidateIds.length === 0) return null;

  const ratingByCreative = await getCreativeRatingSummaries(candidateIds);
  return selectCreativeByLoadThenRating({ candidateIds, loadByCreative, ratingByCreative });
}
