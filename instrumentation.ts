// -----------------------------------------------------------------------------
// @file: instrumentation.ts
// @purpose: Next.js instrumentation hook — boot-time invariants + Sentry init
// -----------------------------------------------------------------------------

import * as Sentry from "@sentry/nextjs";

export async function register() {
  assertDemoModeNotEnabledInProduction();
  assertUpstashConfiguredInProduction();

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

/**
 * Rate limiting relies on Upstash Redis to coordinate counters across the
 * Vercel serverless fleet. Without it, `lib/rate-limit.ts` falls back to a
 * per-instance in-memory Map — which is useless in production because each
 * serverless container has its own counter, so an attacker spreading
 * requests across containers effectively bypasses all rate limits.
 *
 * This was discovered on 2026-04-23 during the security E2E walkthrough:
 * 50+ wrong-password attempts on demo.brandbite.studio with no 429 ever
 * firing, because Upstash was not configured on the demo Vercel project.
 *
 * We gate this assertion on `VERCEL_ENV === "production"` so:
 *   - `npm run dev`           → skipped (dev)
 *   - `npm run build` locally → skipped (no VERCEL_ENV)
 *   - CI `next build`         → skipped (VERCEL_ENV unset)
 *   - Vercel preview deploy   → skipped (VERCEL_ENV="preview")
 *   - Vercel prod deploy      → enforced (VERCEL_ENV="production")
 *
 * "Production" from Vercel's perspective includes the demo.brandbite.studio
 * deploy (main branch → production env). That is intentional: demo must
 * have effective rate limiting too, both to verify the E2E §2 test and so
 * demo isn't a soft target for the same attack.
 */
function assertUpstashConfiguredInProduction() {
  if (process.env.VERCEL_ENV !== "production") return;

  // Match the resolution logic in `lib/rate-limit.ts` — Upstash's Vercel
  // marketplace integration may set either the canonical names or the
  // `KV_REST_API_*` / `UPSTASH_REDIS_REST_KV_REST_API_*` prefix variants.
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;
  if (url && token) return;

  const missing = [!url && "UPSTASH_REDIS_REST_URL", !token && "UPSTASH_REDIS_REST_TOKEN"]
    .filter(Boolean)
    .join(" and ");

  throw new Error(
    `Upstash Redis is required in production but ${missing} is not set. ` +
      "Without Upstash, the rate limiter silently falls back to an " +
      "ineffective per-instance in-memory Map and every endpoint that " +
      "depends on it (auth, AI, webhooks) becomes trivially bypassable. " +
      "Set the env vars on this Vercel project (Settings → Environment " +
      "Variables → Production) and redeploy. See docs/env-vars.md for the " +
      "accepted alternative names (KV_REST_API_*, UPSTASH_REDIS_REST_KV_REST_API_*).",
  );
}

export const onRequestError = Sentry.captureRequestError;
