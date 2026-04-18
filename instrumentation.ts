// -----------------------------------------------------------------------------
// @file: instrumentation.ts
// @purpose: Next.js instrumentation hook — initializes Sentry per runtime
// -----------------------------------------------------------------------------

import * as Sentry from "@sentry/nextjs";

export async function register() {
  assertDemoModeNotEnabledInProduction();

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

function assertDemoModeNotEnabledInProduction() {
  if (process.env.NODE_ENV !== "production") return;

  if (process.env.DEMO_MODE === "true" || process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    throw new Error(
      "DEMO_MODE must not be enabled in production. " +
        "Unset DEMO_MODE and NEXT_PUBLIC_DEMO_MODE in the production environment.",
    );
  }
}

export const onRequestError = Sentry.captureRequestError;
