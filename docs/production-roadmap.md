# Brandbite — Production Roadmap

_Last updated: 2026-04-20 (this doc lives in git; update as we ship.)_

This file captures **what's ready**, **what's missing**, and **what ships in which version** as we move Brandbite from demo to production. It's a living plan — rewrite sections as reality changes.

---

## Status snapshot

### ✅ Production-ready (verified against the code)

- **Core customer loop**: sign up → subscribe → create ticket → creative delivers → customer approves + rates → payout lands in creative ledger.
- **Subscription billing** (Stripe): monthly plans, proration on upgrade/downgrade (PR #120), one-time token top-up packs (PR #117), webhook-driven token credits on renewal.
- **Consultation booking** with Google Calendar OAuth, auto-scheduling with Meet links, freebusy on the picker (PRs #110 / #111 / #114).
- **AI suite**: image, text, design suggestions, background removal — with idempotency (PR #89, #116), token debit/refund, rate limits, per-tool admin config, **brief parsing** (PR #119).
- **Brand guide** per project flows into creative view + AI prompts (PR #122).
- **Admin ops**: company token grants (PR #107), ticket override guardrails (PR #108), bulk ticket ops (PR #118), rating-weighted auto-assign (PR #115).
- **Scheduled creative payouts** (weekly cron) (PR #121).
- **Password reset** via BetterAuth + Resend email.
- **CI**: lint, type-check, unit tests, Next.js build, Postgres integration tests on every PR.
- **Sentry**: wired on client + server + edge runtimes; would capture errors _if_ `SENTRY_DSN` is set in Production.
- **Error boundaries**: per-role boundary pages (`/app/admin/error.tsx`, `/app/customer/error.tsx`, `/app/creative/error.tsx`).

### 🟡 Partial — works in some paths, not all

- **Rate limiting**. Upstash Redis wired (`lib/rate-limit.ts`), applied to AI routes. **Not applied to `/api/auth/*`** — login and password-reset are currently unprotected from credential stuffing. _See Blocker #2 below._

### 🔴 Missing — verified absent in the codebase

- **Email verification on sign-up**. No `requireEmailVerification` in BetterAuth config, no verify-email page.
- **Account deletion / GDPR right-to-erasure**. No `DELETE` endpoint for user accounts, no self-service UI.
- **Privacy policy + Terms of Service pages**. No `/app/legal/`, `/app/privacy/`, `/app/terms/`. The CMS-style `[pageKey]` route exists but no legal content has been authored.
- **Health check endpoint**. No `/api/health` or `/healthz` for uptime monitors.
- **App-level backup automation**. Relies entirely on Neon's point-in-time recovery — fine for v1.0 if we're on a Neon paid tier, but should be called out.

---

## Production blockers (must land before v1.0 launch)

These are the items I'd refuse to launch without. Each is tractable in 1–2 PRs.

### Blocker #1 — Email verification on sign-up

**Why it matters**: Without email verification, a bot can sign up with someone else's address, tie up that email, and poison the customer record. For a paid product with Stripe customer records attached to emails, this is a real support-load risk.

**Scope**: Enable `emailVerification.requireEmailVerification` on BetterAuth. Wire the `sendVerificationEmail` callback through existing Resend helper. Add a `/verify-email` page + resend-verification action.

**Estimated effort**: 1 PR, ~2 hours.

### Blocker #2 — Auth rate limits

**Why it matters**: `/api/auth/*` (BetterAuth) is currently not rate-limited. Credential stuffing is the #1 way accounts get compromised. Same Upstash infrastructure we use for AI.

**Scope**: Wrap the BetterAuth route handler in a rate limiter keyed on IP (`x-forwarded-for`) with a second bucket keyed on email for password-reset requests. Return 429 with `Retry-After` header.

**Estimated effort**: 1 PR, ~1 hour.

### Blocker #3 — GDPR right-to-erasure

**Why it matters**: Required in the EU/UK for any product collecting personal data. Failing to provide a deletion path is a real legal risk if we sell to European companies (which we likely will, given brandbite.studio's audience).

**Scope**:

- `DELETE /api/customer/account` + `/settings` page button.
- Cascade strategy: **soft-delete** the `UserAccount` (anonymize email, name) and hard-delete the session. Keep ledger/tickets for audit (ledger entries are a financial record; we need to retain them per tax/accounting rules). Document in the privacy policy.
- Consider a "leave company" flow as a softer alternative for team members.

**Estimated effort**: 1 PR, ~3 hours. Has design decisions — should discuss before implementing.

### Blocker #4 — Privacy policy + Terms of Service

**Why it matters**: Legally required for any product that takes payment + collects data. Stripe requires it. Many corporate customers won't buy without reviewing these first.

**Scope**: Author both docs (with a lawyer, not me) and publish as static pages under `/privacy` and `/terms`. Link from the footer, from sign-up consent, and from the Stripe checkout success page.

**Estimated effort**: Legal review is the pacing item. Template draft + publish is half a day. **I cannot write the legal text — this needs a lawyer or a vetted template service like Termly / Iubenda.**

### Blocker #5 — Health check endpoint + uptime monitoring

**Why it matters**: If the app goes down overnight, nobody knows until a customer complains. A 5xx on a single cron job shouldn't take the whole system with it; we need visibility.

**Scope**:

- `GET /api/health` returning `{ ok: true, db: "ok"|"down", stripe: "ok"|"down" }` with a Prisma ping + Stripe reachability check.
- Configure Vercel's built-in monitoring or a third-party (BetterStack, Upptime) to hit it.

**Estimated effort**: 1 PR, ~30 min. Monitoring signup is separate.

### Blocker #6 — Env var audit + hardening

**Why it matters**: Missing secrets in Production would fail silently in places (Sentry, Resend, CRON_SECRET, Google OAuth). A checklist prevents "we forgot to set it and the Monday cron ran as a noop for 3 weeks".

**Scope**: Create `docs/env-vars.md` listing every required env var, which environments need it (Production / Preview / Dev), and what happens if it's missing. Grep `process.env.*` to confirm coverage.

**Estimated effort**: 1 PR, ~1 hour.

---

## Nice-but-not-blockers (Phase D remaining)

Ranked by honest customer/ops impact. Small/Medium/Large are my effort estimates.

| Item                                        | Size | Why it matters                                                              | Can wait?      |
| ------------------------------------------- | ---- | --------------------------------------------------------------------------- | -------------- |
| **D11** prompt templates per job type       | S    | AI quality bump — each job type gets a tuned system prompt. Cheap win.      | Yes, post-v1.0 |
| **D15** creative utilization dashboard      | S    | Admin sees who's overloaded at a glance. Needed once you have >3 creatives. | Yes, v1.1      |
| **D9** creative portfolio auto-populated    | S    | Marketing — public portfolio page per creative. Not core.                   | Yes, v1.2      |
| **D14** cohort retention in token-analytics | M    | Your insight, not customer-facing.                                          | Yes, v1.2+     |
| **D10** streaming text generation           | M    | Perceived speed. Real UX polish.                                            | Yes, v1.1      |
| **D12** image upscaling / variations        | M    | AI polish. Single-button adds.                                              | Yes, v1.2      |
| **D7** time tracking per ticket             | M    | Adds creative friction (start/stop timer). Optional.                        | Yes or skip    |
| **D18** referral / affiliate program        | L    | Needs marketing + legal alignment first.                                    | Yes, v2.0+     |

---

## Phased release plan

### v1.0 — "Can actually take money from strangers" (target: ~2 weeks)

**Must-land**:

- Blockers 1–6 from above
- Stripe product catalog finalized (real prices, not test prices)
- Domain verified in Resend
- `SENTRY_DSN` set, errors reach a Sentry project
- `CRON_SECRET` set, Monday payout cron verified running
- Privacy + TOS published

**Should-land** (only if quick):

- D11 prompt templates per job type (~1 PR)

### v1.1 — "First polish pass" (target: 2 weeks after v1.0)

- D15 creative utilization dashboard (admin safety net as creative count grows)
- D10 streaming text generation (perceived AI speed)
- Housekeeping: B3 split ticket routes (for maintainability), English-ize Turkish comments, resolve any 240-token-drift-style data anomalies
- Customer feedback loop wiring (in-app "report an issue" or similar)

### v1.2 — "Growth features"

- D9 portfolio auto-population
- D12 image upscaling
- D14 cohort retention analytics
- Moodboard re-enablement (currently deferred — decide if/when to bring back)

### v2.0+ — "Scale features"

- D18 referral / affiliate program
- Stripe Connect for automated creative payouts (replaces the current manual mark-paid)
- D6 real-time ticket chat (if user feedback demands it)
- D7 time tracking (if creatives request it; don't build until asked)

---

## Pre-launch checklist (the final week before v1.0)

Run through this in order. Each row is a blocker that's cheap to miss and expensive to fix under launch pressure.

### Legal + compliance

- [ ] Privacy policy published at `/privacy`
- [ ] Terms of Service published at `/terms`
- [ ] Cookie banner (if targeting EU users — required under ePrivacy)
- [ ] Sign-up consent checkbox linking to both
- [ ] Legal review of: token refund policy, creative payout terms, consultation no-show policy

### Stripe

- [ ] Switch from test mode to live mode (replace `sk_test_*` with `sk_live_*`)
- [ ] Live webhook endpoint configured + secret set as `STRIPE_WEBHOOK_SECRET`
- [ ] Every Plan row has a real `stripePriceId` (live-mode)
- [ ] Top-up packs created in Stripe + linked
- [ ] Tax setup (Stripe Tax / manual) confirmed for your jurisdiction
- [ ] Test one real charge through the live flow, then refund it

### Email deliverability

- [ ] `brandbite.studio` verified in Resend (SPF + DKIM DNS records)
- [ ] `EMAIL_FROM` points at that verified domain
- [ ] Send a test password-reset, verification, and invoice email to an inbox you control; check the rendering and the spam-folder placement
- [ ] DMARC record set on the domain

### Environment variables (Production)

Confirm each is set in Vercel → Project → Settings → Environment Variables (Production):

- [ ] `DATABASE_URL` (Neon production branch, not the demo branch)
- [ ] `BETTER_AUTH_SECRET` (random 32+ chars)
- [ ] `NEXT_PUBLIC_APP_URL` (e.g. `https://app.brandbite.studio`)
- [ ] `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- [ ] `OPENAI_API_KEY` (+ `OPENAI_ORG_ID` if used)
- [ ] `REPLICATE_API_TOKEN`
- [ ] `RESEND_API_KEY`, `EMAIL_FROM`
- [ ] `R2_*` (ACCOUNT_ID, ACCESS_KEY_ID, SECRET, BUCKET, PUBLIC_BASE_URL, REGION)
- [ ] `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (rate limiter)
- [ ] `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`
- [ ] `CRON_SECRET` (payout cron)
- [ ] `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`
- [ ] `DEMO_MODE` and `ALLOW_DEMO_IN_PROD` are **unset or false** on production (they should only be set on demo.brandbite.studio)

### Database

- [ ] Neon Production branch on a **paid tier** (for point-in-time recovery)
- [ ] All migrations applied via `prisma migrate deploy` on deploy
- [ ] Seed data for production: admin user(s), active plans, job types, payout rules, etc.

### Monitoring / rollback

- [ ] Sentry receiving real errors (force one by throwing on a dummy route, then remove)
- [ ] Vercel deploy protection (branch protection on `main`, required reviewers for future PRs)
- [ ] Rollback plan: Vercel keeps previous deploys; confirm how to 1-click roll back if v1.0 explodes
- [ ] Health check endpoint returns 200 from production URL

### Smoke tests (on production, before announcing)

- [ ] Sign up with a brand-new email → receive verification email → verify → land in dashboard
- [ ] Subscribe to a real plan with a test card (Stripe provides live-mode test cards for this)
- [ ] Create a ticket → auto-assign lands on a creative → creative delivers → approve → rate → check ledger
- [ ] Book a consultation → Google Calendar event appears → cancel → calendar event removed
- [ ] Password reset flow from signed-out state
- [ ] Admin bulk ops work on real tickets
- [ ] 402 flows work (drain a test company's balance via admin grant, try every action)

### First-week vigilance

- [ ] Watch Sentry for new error signatures
- [ ] Watch Stripe dashboard for payment failures / disputes
- [ ] Monday morning: verify payout cron ran (check logs + `/admin/withdrawals` for new PENDING rows)
- [ ] Monitor demo user feedback channels (if any) for bug reports before wider launch

---

## What this document is not

- A marketing plan (separate artifact).
- A hiring plan.
- A pricing strategy.
- A legal document (the Privacy Policy and TOS are themselves separate artifacts).

## How to use this doc

- **Before picking the next PR**: re-read the Blockers section. If any are still unchecked, ask whether the feature you're about to build is more important than closing a blocker.
- **Before cutting v1.0**: run the Pre-launch checklist top to bottom. Don't skip rows just because you "think" they're done.
- **After each major PR**: update the Status snapshot at the top so this file stays honest.
