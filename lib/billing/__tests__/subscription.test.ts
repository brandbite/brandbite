// -----------------------------------------------------------------------------
// @file: lib/billing/__tests__/subscription.test.ts
// @purpose: hasLiveSubscription decides whether a new subscription checkout is
//           allowed — a wrong "false" lets a company get billed twice.
// -----------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import { hasLiveSubscription } from "../subscription";

describe("hasLiveSubscription", () => {
  it("is false without a Stripe subscription", () => {
    expect(hasLiveSubscription({ stripeSubscriptionId: null, billingStatus: null })).toBe(false);
    expect(hasLiveSubscription({ stripeSubscriptionId: null, billingStatus: "ACTIVE" })).toBe(
      false,
    );
  });

  it("is true for active and past-due subscriptions", () => {
    expect(hasLiveSubscription({ stripeSubscriptionId: "sub_1", billingStatus: "ACTIVE" })).toBe(
      true,
    );
    expect(hasLiveSubscription({ stripeSubscriptionId: "sub_1", billingStatus: "PAST_DUE" })).toBe(
      true,
    );
    expect(hasLiveSubscription({ stripeSubscriptionId: "sub_1", billingStatus: null })).toBe(true);
  });

  it("is false once the subscription is cancelled", () => {
    expect(hasLiveSubscription({ stripeSubscriptionId: "sub_1", billingStatus: "CANCELED" })).toBe(
      false,
    );
  });
});
