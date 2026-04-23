# Brandbite — Environment Variables

_Last updated: 2026-04-20. Regenerate by grepping `process.env.*` across `lib/` and `app/`._

This reference lists every env var the app reads, which environments need it, and the failure mode when it's absent. Use it as the checklist when setting up a new Vercel environment.

## Legend

- **Required in Prod**: the app is broken or insecure without this in Production.
- **Required for feature**: a specific feature breaks silently or returns errors when missing, but the rest of the app works.
- **Optional**: nice-to-have, has a sensible fallback.

## Core runtime

| Var                   | Required in Prod | Used by                                                  | What happens if missing                                                                                                                                                                                                                                                 |
| --------------------- | ---------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`        | ✅ Required      | Prisma (everywhere)                                      | App boots but every DB call 500s. Set to the Neon **pooled** URL (subdomain contains `-pooler`) for serverless efficiency.                                                                                                                                              |
| `DIRECT_URL`          | ✅ Required      | `prisma migrate deploy` on every production Vercel build | `next build` fails at migrate step with P1002 "Timed out trying to acquire a postgres advisory lock" because pooler-held locks drop at transaction boundaries. Set to the **non-pooled** Neon URL (same host as `DATABASE_URL` but without `-pooler` in the subdomain). |
| `BETTER_AUTH_SECRET`  | ✅ Required      | `lib/better-auth.ts`                                     | Sessions silently broken. Generate ≥32 random chars.                                                                                                                                                                                                                    |
| `NEXT_PUBLIC_APP_URL` | ✅ Required      | Stripe redirects, Google OAuth                           | Stripe + Google redirects fall back to `localhost:3000`. Must be prod URL.                                                                                                                                                                                              |
| `NODE_ENV`            | ✅ Required      | Various gates (demo mode, etc.)                          | Vercel sets this automatically.                                                                                                                                                                                                                                         |

## Payments (Stripe)

| Var                     | Required in Prod | Used by                | What happens if missing                                                  |
| ----------------------- | ---------------- | ---------------------- | ------------------------------------------------------------------------ |
| `STRIPE_SECRET_KEY`     | ✅ Required      | `lib/stripe.ts`        | Checkout + webhook + plan change all 500. Swap test → live at cutover.   |
| `STRIPE_WEBHOOK_SECRET` | ✅ Required      | `/api/billing/webhook` | Token credits never applied on real payments. Get from Stripe dashboard. |

## AI

| Var                   | Required in Prod   | Used by                             | What happens if missing                                                       |
| --------------------- | ------------------ | ----------------------------------- | ----------------------------------------------------------------------------- |
| `OPENAI_API_KEY`      | ✅ Required for AI | text + image + brief-parsing routes | AI generations return 500; customers get the insufficient-tokens/error modal. |
| `OPENAI_ORG_ID`       | Optional           | OpenAI client init                  | Not needed unless you're on a multi-org workspace.                            |
| `REPLICATE_API_TOKEN` | ✅ Required for AI | image + background-removal          | Image generation fails over to OpenAI if available; BG removal 500s.          |

## Storage (Cloudflare R2)

| Var                    | Required in Prod | Used by     | What happens if missing                                   |
| ---------------------- | ---------------- | ----------- | --------------------------------------------------------- |
| `R2_BUCKET`            | ✅ Required      | `lib/r2.ts` | All uploads + presigns 500.                               |
| `R2_ACCESS_KEY_ID`     | ✅ Required      | `lib/r2.ts` | Same as above.                                            |
| `R2_SECRET_ACCESS_KEY` | ✅ Required      | `lib/r2.ts` | Same as above.                                            |
| `R2_ENDPOINT`          | ✅ Required      | `lib/r2.ts` | Same as above.                                            |
| `R2_REGION`            | Optional         | `lib/r2.ts` | Defaults to `"auto"`.                                     |
| `R2_PUBLIC_BASE_URL`   | Recommended      | `lib/r2.ts` | Presigned URLs used even for public content (extra cost). |

## Email (Resend)

| Var              | Required in Prod | Used by        | What happens if missing                                                            |
| ---------------- | ---------------- | -------------- | ---------------------------------------------------------------------------------- |
| `RESEND_API_KEY` | ✅ Required      | `lib/email.ts` | Password reset + verification emails silently no-op. Users can't sign up.          |
| `EMAIL_FROM`     | Recommended      | `lib/email.ts` | Defaults to `"BrandBite <notifications@brandbite.studio>"`. Needs verified domain. |

## Google Calendar OAuth (consultation feature)

| Var                          | Required in Prod        | Used by               | What happens if missing                                                          |
| ---------------------------- | ----------------------- | --------------------- | -------------------------------------------------------------------------------- |
| `GOOGLE_OAUTH_CLIENT_ID`     | ✅ Required for feature | `lib/google/oauth.ts` | Connect Google button returns clear error.                                       |
| `GOOGLE_OAUTH_CLIENT_SECRET` | ✅ Required for feature | `lib/google/oauth.ts` | Same as above.                                                                   |
| `GOOGLE_OAUTH_REDIRECT_URI`  | ✅ Required for feature | `lib/google/oauth.ts` | Must be `<NEXT_PUBLIC_APP_URL>/api/admin/consultation-settings/google/callback`. |

## Rate limiter (Upstash Redis)

| Var                        | Required in Prod              | Used by             | What happens if missing                                                                                                                                                                                                                                                                           |
| -------------------------- | ----------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UPSTASH_REDIS_REST_URL`   | ✅ **Required** (prod + demo) | `lib/rate-limit.ts` | Production deploys (`VERCEL_ENV=production`) **fail at boot** via the assertion in `instrumentation.ts`. Without this, the rate limiter silently falls back to an ineffective per-instance in-memory Map and every endpoint that depends on it (auth, AI, webhooks) becomes trivially bypassable. |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ **Required** (prod + demo) | `lib/rate-limit.ts` | Same as above.                                                                                                                                                                                                                                                                                    |

> Vercel's Upstash integration may set these under the prefix `KV_REST_API_*` or `UPSTASH_REDIS_REST_KV_REST_API_*`. Both `lib/rate-limit.ts` and the boot assertion in `instrumentation.ts` accept either for compatibility.
>
> Preview deploys (`VERCEL_ENV=preview`), local `next build`, and CI do **not** trigger the assertion — it only fires on real production deploys (demo _and_ prod), which is where the silent-fallback bug actually matters.

## Scheduled jobs

| Var           | Required in Prod             | Used by                     | What happens if missing                                         |
| ------------- | ---------------------------- | --------------------------- | --------------------------------------------------------------- |
| `CRON_SECRET` | ✅ Required for auto-payouts | `/api/cron/process-payouts` | Monday cron returns 401, auto-payouts silently skipped forever. |

## Observability (Sentry)

| Var                            | Required in Prod | Used by                      | What happens if missing                                 |
| ------------------------------ | ---------------- | ---------------------------- | ------------------------------------------------------- |
| `SENTRY_DSN`                   | ✅ Recommended   | `sentry.server.config.ts`    | Server errors go to console only.                       |
| `NEXT_PUBLIC_SENTRY_DSN`       | ✅ Recommended   | `sentry.client.config.ts`    | Client errors go to console only.                       |
| `SENTRY_AUTH_TOKEN`            | Optional         | Build-time source-map upload | Sentry traces still work but stack traces are minified. |
| `SENTRY_ORG`, `SENTRY_PROJECT` | Optional         | Source-map upload            | As above.                                               |

## Demo mode (disable on production)

| Var                              | Required in Prod     | Used by       | What happens if missing / set                                                        |
| -------------------------------- | -------------------- | ------------- | ------------------------------------------------------------------------------------ |
| `DEMO_MODE`                      | ❌ **Must be unset** | `lib/auth.ts` | Setting to `"true"` swaps auth to a cookie persona switcher. Leak on prod = serious. |
| `NEXT_PUBLIC_DEMO_MODE`          | ❌ **Must be unset** | UI banners    | Shows the demo banner to users.                                                      |
| `ALLOW_DEMO_IN_PROD`             | ❌ **Must be unset** | Safety gate   | Only set on the demo environment (demo.brandbite.studio).                            |
| `NEXT_PUBLIC_ALLOW_DEMO_IN_PROD` | ❌ **Must be unset** | Safety gate   | Same as above.                                                                       |

---

## Production checklist

Run top to bottom before announcing v1.0:

1. **Core**: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_APP_URL` all set.
2. **Stripe**: swap test keys for live, verify webhook endpoint + secret.
3. **AI**: live `OPENAI_API_KEY` with billing enabled, `REPLICATE_API_TOKEN`.
4. **R2**: bucket created, CORS allows your domain for presigns, all 5 R2 vars set.
5. **Resend**: domain `brandbite.studio` verified (SPF + DKIM), `EMAIL_FROM` matches. Send a test email to an external inbox and verify inbox placement.
6. **Google Calendar**: OAuth client created in Google Cloud Console, redirect URI matches Production URL.
7. **Upstash**: Redis instance provisioned and either integration-linked or env vars set manually.
8. **Cron**: `CRON_SECRET` random, confirmed matches what Vercel Cron sends in the Authorization header.
9. **Sentry**: project created, DSN set client + server, test error fires and reaches the dashboard.
10. **Demo flags**: triple-check all 4 demo variables are _unset_ on Production. Leaking `DEMO_MODE=true` into Production bypasses real auth.

When in doubt, grep:

```bash
grep -rn "process.env." lib/ app/ --include="*.ts" --include="*.tsx" | sort -u
```
