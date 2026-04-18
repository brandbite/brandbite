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

  const demoRequested =
    process.env.DEMO_MODE === "true" || process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  if (!demoRequested) return;

  // Intentional demo deploys (e.g. demo.brandbite.studio) opt in explicitly.
  const allowedInProd =
    process.env.ALLOW_DEMO_IN_PROD === "true" ||
    process.env.NEXT_PUBLIC_ALLOW_DEMO_IN_PROD === "true";
  if (allowedInProd) return;

  throw new Error(
    "DEMO_MODE is enabled in a production build without ALLOW_DEMO_IN_PROD. " +
      "If this is the intentional demo deploy, set ALLOW_DEMO_IN_PROD=true " +
      "(and NEXT_PUBLIC_ALLOW_DEMO_IN_PROD=true for the client banner). " +
      "Otherwise unset DEMO_MODE and NEXT_PUBLIC_DEMO_MODE.",
  );
}

export const onRequestError = Sentry.captureRequestError;
