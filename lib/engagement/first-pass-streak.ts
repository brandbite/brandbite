// -----------------------------------------------------------------------------
// @file: lib/engagement/first-pass-streak.ts
// @purpose: A creative's first-pass streak: how many of their latest finished
//           requests in a row were approved without the customer asking for a
//           revision. Rewards getting it right, not getting it done fast.
// -----------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";

/** Newest first: true when the request was approved with no revision request. */
export function countStreak(firstPassNewestFirst: boolean[]): number {
  const firstMiss = firstPassNewestFirst.indexOf(false);
  return firstMiss === -1 ? firstPassNewestFirst.length : firstMiss;
}

/** How far back we look. A longer streak than this shows as this number. */
const LOOKBACK = 200;

export async function getFirstPassStreak(creativeId: string): Promise<number> {
  const done = await prisma.ticket.findMany({
    where: { creativeId, status: "DONE" },
    orderBy: [{ completedAt: "desc" }, { updatedAt: "desc" }],
    take: LOOKBACK,
    select: {
      // A revision with customer feedback is a revision request.
      revisions: { where: { feedbackAt: { not: null } }, select: { id: true }, take: 1 },
    },
  });
  return countStreak(done.map((t) => t.revisions.length === 0));
}
