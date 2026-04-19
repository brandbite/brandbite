// -----------------------------------------------------------------------------
// @file: lib/tickets/auto-assign.ts
// @purpose: Auto-assign resolution helpers — compose company-level default
//           and project-level override into a single effective flag, and
//           pick a creative from a candidate list using (1) lowest load and
//           (2) highest rating as a tie-breaker.
//
// Extracted from app/api/customer/tickets/route.ts so the rule is
// unit-testable and reusable across any route that needs to decide
// whether a new ticket should be auto-assigned to a creative.
// -----------------------------------------------------------------------------

import { AutoAssignMode } from "@prisma/client";

import type { CreativeRatingSummary } from "@/lib/ratings/creative-ratings";

/**
 * Given a company's default auto-assign flag and a project-level mode,
 * return whether auto-assign is effectively enabled for a ticket that
 * belongs to the project.
 *
 *   - project mode `INHERIT` (or missing) → use company default
 *   - project mode `ON`                   → always on
 *   - project mode `OFF`                  → always off
 */
export function isAutoAssignEnabled(
  companyDefault: boolean,
  projectMode?: AutoAssignMode | null,
): boolean {
  if (!projectMode || projectMode === AutoAssignMode.INHERIT) {
    return companyDefault;
  }
  if (projectMode === AutoAssignMode.ON) return true;
  if (projectMode === AutoAssignMode.OFF) return false;
  return companyDefault;
}

// ---------------------------------------------------------------------------
// Creative selection
// ---------------------------------------------------------------------------

/**
 * Pick a single creative from a candidate list using:
 *   1. lowest current load wins (priority × tokenCost of open tickets)
 *   2. highest overall rating breaks ties (avg of quality+communication+speed)
 *   3. a creative with at least one rating beats an unrated one on ties
 *   4. iteration order of `candidateIds` as the final deterministic tiebreak
 *
 * `load` is a number you precompute outside this helper. `ratings` is the
 * shape returned by `getCreativeRatingSummaries()` — unrated entries are
 * `EMPTY_RATING_SUMMARY` (overall = null). Keeping this pure + data-in
 * makes it trivially unit-testable without touching the DB.
 *
 * Returns `null` when `candidateIds` is empty.
 */
export function selectCreativeByLoadThenRating(input: {
  candidateIds: string[];
  loadByCreative: Map<string, number>;
  ratingByCreative: Map<string, CreativeRatingSummary>;
}): string | null {
  const { candidateIds, loadByCreative, ratingByCreative } = input;
  if (candidateIds.length === 0) return null;

  let best: string | null = null;
  for (const id of candidateIds) {
    if (!best) {
      best = id;
      continue;
    }

    const bestLoad = loadByCreative.get(best) ?? 0;
    const currLoad = loadByCreative.get(id) ?? 0;
    if (currLoad < bestLoad) {
      best = id;
      continue;
    }
    if (currLoad > bestLoad) continue;

    // Loads equal → prefer higher overall rating; unrated stays last.
    const bestRating = ratingByCreative.get(best)?.overall ?? null;
    const currRating = ratingByCreative.get(id)?.overall ?? null;
    if (bestRating === null && currRating !== null) {
      best = id;
      continue;
    }
    if (bestRating !== null && currRating === null) continue;
    if (bestRating !== null && currRating !== null && currRating > bestRating) {
      best = id;
    }
    // Fully equal (or both unrated) → keep first-seen for determinism.
  }
  return best;
}
