// -----------------------------------------------------------------------------
// @file: lib/stripe.ts
// @purpose: Central Stripe client for Brandbite (test + live modes)
// @version: v0.1.0
// @status: active
// @lastUpdate: 2025-11-17
// -----------------------------------------------------------------------------

import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  // Bu hatayı dev ortamında görmek istiyoruz; prod'da da deploy sırasında fark edilir.
  throw new Error(
    "Missing STRIPE_SECRET_KEY environment variable. Please set it in your .env/.env.local.",
  );
}

export const stripe = new Stripe(secretKey, {
  apiVersion: "2024-06-20" as Stripe.StripeConfig["apiVersion"],
});

/**
 * Helper for building absolute URLs for Stripe redirects (success/cancel).
 * Falls back to localhost in dev.
 */
export function getAppBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv && fromEnv.startsWith("http")) {
    return fromEnv.replace(/\/+$/, "");
  }
  return "http://localhost:3000";
}
