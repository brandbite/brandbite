// -----------------------------------------------------------------------------
// @file: lib/stripe-webhook-idempotency.ts
// @purpose: Small helper pair around the `ProcessedStripeEvent` ledger used
//           by `app/api/billing/webhook/route.ts` to make Stripe webhook
//           delivery idempotent.
//
//           Stripe retries on any non-2xx response for up to ~3 days with
//           exponential backoff, and in rare cases two Stripe delivery workers
//           can race on the same event (response lost in transit, etc.). A
//           duplicate delivery of a non-idempotent handler path — e.g. the
//           monthly subscription renewal credit in `invoice.payment_succeeded`
//           — would double-credit tokens.
//
//           We gate the handler on a unique insert into `ProcessedStripeEvent`:
//             reserve → handler body → release on failure / commit on success.
// -----------------------------------------------------------------------------

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type ReserveResult =
  /** First time this eventId is seen; the caller should run the handler. */
  | { reserved: true }
  /** Already processed (or mid-process); the caller should return 200 OK. */
  | { reserved: false; reason: "already-processed" };

/**
 * Insert a dedup row for `eventId`. Returns whether the reservation was
 * newly created. On P2002 unique violation we interpret "already processed"
 * and tell the caller to skip the handler. Any other DB error propagates —
 * the caller should 500 so Stripe retries.
 */
export async function reserveStripeEvent(
  eventId: string,
  eventType: string,
): Promise<ReserveResult> {
  try {
    await prisma.processedStripeEvent.create({
      data: { eventId, eventType },
    });
    return { reserved: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { reserved: false, reason: "already-processed" };
    }
    throw err;
  }
}

/**
 * Remove a previously-reserved dedup row. Called from the handler's error
 * path so Stripe's retry can reprocess a failed event. Best-effort: we log
 * and swallow errors here because the calling handler is already in a
 * failure flow and should still return 500 to Stripe.
 */
export async function releaseStripeEvent(eventId: string): Promise<void> {
  try {
    await prisma.processedStripeEvent.delete({ where: { eventId } });
  } catch (err) {
    // A missing row (P2025) is fine — the dedup row was never created, or
    // something else already cleaned it up. Log anything else so we can
    // spot real DB trouble.
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2025") {
      console.error("[stripe-webhook-idempotency] failed to release event", {
        eventId,
        err,
      });
    }
  }
}
