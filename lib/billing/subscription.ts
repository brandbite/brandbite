// -----------------------------------------------------------------------------
// @file: lib/billing/subscription.ts
// @purpose: Single answer to "does this company already have a live Stripe
//           subscription?" — shared by the checkout route (refuses to start a
//           second subscription) and the customer settings API (decides
//           whether to offer "Start subscription" or plan switching).
// -----------------------------------------------------------------------------

import type { BillingStatus } from "@prisma/client";

type CompanyBillingFields = {
  stripeSubscriptionId: string | null;
  billingStatus: BillingStatus | null;
};

/**
 * True while the company is subscribed in Stripe and the subscription has not
 * been cancelled. PAST_DUE still counts: the subscription exists and Stripe is
 * retrying payment, so a new checkout would create a second subscription.
 */
export function hasLiveSubscription(company: CompanyBillingFields): boolean {
  return !!company.stripeSubscriptionId && company.billingStatus !== "CANCELED";
}
