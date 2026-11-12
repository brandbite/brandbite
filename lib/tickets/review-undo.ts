// -----------------------------------------------------------------------------
// @file: lib/tickets/review-undo.ts
// @purpose: The one-minute undo after a creative sends a version for review.
//           For that minute the customer hasn't been told yet (the
//           notification, email and Slack message wait), so pulling the
//           request back is a clean undo: the version is withdrawn, isn't
//           counted, and the customer never hears about it. After the minute
//           a pull-back is the ordinary one: the version stays and the
//           customer is told. Pure and client-safe.
// -----------------------------------------------------------------------------

/** How long a sent version can be undone, and how long the customer's notice waits. */
export const REVIEW_UNDO_SECONDS = 60;

/** The server accepts an Undo click that left the browser just inside the minute. */
const GRACE_MS = 5_000;

/** How long the customer's notice waits: past the last moment an undo is accepted. */
export const REVIEW_NOTICE_DELAY_MS = REVIEW_UNDO_SECONDS * 1000 + GRACE_MS + 1_000;

/** Whether pulling back a version sent at `submittedAt` still counts as an undo. */
export function canUndoReview(
  revision: { submittedAt: Date; feedbackAt: Date | null },
  now: Date = new Date(),
): boolean {
  if (revision.feedbackAt) return false;
  return now.getTime() - revision.submittedAt.getTime() <= REVIEW_UNDO_SECONDS * 1000 + GRACE_MS;
}

/** Milliseconds of undo left for a version the browser saw sent at `sentAtMs`. */
export function undoMsLeft(sentAtMs: number, nowMs: number = Date.now()): number {
  return Math.max(0, REVIEW_UNDO_SECONDS * 1000 - (nowMs - sentAtMs));
}
