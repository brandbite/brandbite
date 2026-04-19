// -----------------------------------------------------------------------------
// @file: lib/ratings/creative-ratings.ts
// @purpose: Read-side helpers for creative ratings. Aggregate per-creative
//           averages (used by the admin panel and by auto-assign tie-breaks),
//           and a simple listing for the admin per-creative drill-down.
// -----------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";

export type CreativeRatingSummary = {
  /** Number of ratings received. Zero when the creative has never been rated. */
  count: number;
  /** Straight mean of quality + communication + speed averages. null when count=0. */
  overall: number | null;
  /** Per-dimension averages (1..5). null when count=0. */
  quality: number | null;
  communication: number | null;
  speed: number | null;
};

export const EMPTY_RATING_SUMMARY: CreativeRatingSummary = {
  count: 0,
  overall: null,
  quality: null,
  communication: null,
  speed: null,
};

/**
 * Aggregate a creative's ratings into a single summary. Returns
 * EMPTY_RATING_SUMMARY when the creative has no ratings yet — callers can
 * treat `overall === null` as "no signal yet" and fall back to other
 * ranking criteria.
 */
export async function getCreativeRatingSummary(creativeId: string): Promise<CreativeRatingSummary> {
  const agg = await prisma.creativeRating.aggregate({
    where: { creativeId },
    _count: { _all: true },
    _avg: { quality: true, communication: true, speed: true },
  });

  const count = agg._count._all;
  if (count === 0) return EMPTY_RATING_SUMMARY;

  const quality = agg._avg.quality ?? 0;
  const communication = agg._avg.communication ?? 0;
  const speed = agg._avg.speed ?? 0;
  const overall = (quality + communication + speed) / 3;

  return { count, overall, quality, communication, speed };
}

/**
 * Batched variant: summary for many creatives in one query. Missing entries
 * default to EMPTY_RATING_SUMMARY so a caller iterating over a set of
 * creatives always gets a value.
 */
export async function getCreativeRatingSummaries(
  creativeIds: string[],
): Promise<Map<string, CreativeRatingSummary>> {
  const result = new Map<string, CreativeRatingSummary>();
  if (creativeIds.length === 0) return result;
  for (const id of creativeIds) result.set(id, EMPTY_RATING_SUMMARY);

  const rows = await prisma.creativeRating.groupBy({
    by: ["creativeId"],
    where: { creativeId: { in: creativeIds } },
    _count: { _all: true },
    _avg: { quality: true, communication: true, speed: true },
  });

  for (const row of rows) {
    const count = row._count._all;
    if (count === 0) continue;
    const quality = row._avg.quality ?? 0;
    const communication = row._avg.communication ?? 0;
    const speed = row._avg.speed ?? 0;
    result.set(row.creativeId, {
      count,
      overall: (quality + communication + speed) / 3,
      quality,
      communication,
      speed,
    });
  }

  return result;
}
