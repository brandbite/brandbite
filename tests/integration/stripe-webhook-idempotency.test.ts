// -----------------------------------------------------------------------------
// @file: tests/integration/stripe-webhook-idempotency.test.ts
// @purpose: Verify the reserve / release pair around ProcessedStripeEvent
//           against a real Postgres. These are the load-bearing primitives
//           for Stripe webhook idempotency — if this test passes, a retried
//           webhook delivery for the same event.id becomes a 200-no-op at
//           app/api/billing/webhook/route.ts without touching the handler
//           body.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { releaseStripeEvent, reserveStripeEvent } from "@/lib/stripe-webhook-idempotency";

import { resetDatabase } from "./helpers/db";

describe("stripe-webhook-idempotency (integration)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("reserves a fresh eventId and records the event type", async () => {
    const result = await reserveStripeEvent("evt_first", "invoice.payment_succeeded");
    expect(result).toEqual({ reserved: true });

    const row = await prisma.processedStripeEvent.findUnique({
      where: { eventId: "evt_first" },
    });
    expect(row).not.toBeNull();
    expect(row?.eventType).toBe("invoice.payment_succeeded");
  });

  it("returns { reserved: false } when the same eventId is replayed", async () => {
    const first = await reserveStripeEvent("evt_replay", "invoice.payment_succeeded");
    expect(first.reserved).toBe(true);

    const second = await reserveStripeEvent("evt_replay", "invoice.payment_succeeded");
    expect(second).toEqual({ reserved: false, reason: "already-processed" });

    // Only one row should exist — the unique constraint held.
    const rows = await prisma.processedStripeEvent.findMany({
      where: { eventId: "evt_replay" },
    });
    expect(rows).toHaveLength(1);
  });

  it("treats two different eventIds as independent", async () => {
    const a = await reserveStripeEvent("evt_a", "customer.subscription.updated");
    const b = await reserveStripeEvent("evt_b", "customer.subscription.updated");
    expect(a.reserved).toBe(true);
    expect(b.reserved).toBe(true);

    const count = await prisma.processedStripeEvent.count();
    expect(count).toBe(2);
  });

  it("releaseStripeEvent deletes the row so a subsequent reserve succeeds", async () => {
    await reserveStripeEvent("evt_rollback", "invoice.payment_succeeded");
    await releaseStripeEvent("evt_rollback");

    const row = await prisma.processedStripeEvent.findUnique({
      where: { eventId: "evt_rollback" },
    });
    expect(row).toBeNull();

    const reReserve = await reserveStripeEvent("evt_rollback", "invoice.payment_succeeded");
    expect(reReserve.reserved).toBe(true);
  });

  it("releaseStripeEvent on a missing row does not throw", async () => {
    // Best-effort rollback must not surface P2025 to the caller, since the
    // webhook handler is already on its way to a 500 and shouldn't blow up
    // trying to clean up.
    await expect(releaseStripeEvent("evt_never_existed")).resolves.toBeUndefined();
  });

  it("enforces the unique primary key at the DB level", async () => {
    // Defensive belt-and-braces: even if the application-level branch in
    // reserveStripeEvent regresses, the DB constraint must still reject the
    // second insert. This is the last line of defense against double-credit.
    await prisma.processedStripeEvent.create({
      data: { eventId: "evt_db_level", eventType: "checkout.session.completed" },
    });

    await expect(
      prisma.processedStripeEvent.create({
        data: { eventId: "evt_db_level", eventType: "checkout.session.completed" },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
});
