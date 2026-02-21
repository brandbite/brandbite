// -----------------------------------------------------------------------------
// @file: sentry.edge.config.ts
// @purpose: Sentry edge runtime initialization (middleware, edge functions)
// -----------------------------------------------------------------------------

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
});
