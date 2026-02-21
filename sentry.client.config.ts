// -----------------------------------------------------------------------------
// @file: sentry.client.config.ts
// @purpose: Sentry client-side initialization (browser)
// -----------------------------------------------------------------------------

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring
  tracesSampleRate: 1.0,

  // Session replay — 10% of sessions, 100% of sessions with errors
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [Sentry.replayIntegration()],

  // Filter out known non-actionable errors
  ignoreErrors: [
    "ResizeObserver loop",
    "ResizeObserver loop completed with undelivered notifications",
  ],

  environment: process.env.NODE_ENV,
});
