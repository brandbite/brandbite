// -----------------------------------------------------------------------------
// @file: sentry.server.config.ts
// @purpose: Sentry server-side initialization (Node.js runtime)
// -----------------------------------------------------------------------------

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
});
