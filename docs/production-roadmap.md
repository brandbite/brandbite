# Brandbite — Production Roadmap

_Last updated: 2026-04-23 — Security Plan L1–L6 shipped (audit log, confirmations, receipts, blocked alerts, email MFA + TOTP upgrade, 2-person approval) + auth hardening pass (per-email rate limit, password complexity, session revocation on reset, explicit cookie attributes)_

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
- **SITE_OWNER vs SITE_ADMIN split** (PR #144): money-moving actions (withdrawals approve/mark-paid, plan management, payout rules, company token grants, ticket financial overrides, consultation pricing, AI pricing edits, hard deletes, promote-to-admin, Google OAuth config) locked to `SITE_OWNER`; `SITE_ADMIN` keeps everything else. Server-side role guards in 14 API routes + owner-only banner on affected admin pages + `useSessionRole()` hook + 68 role-matrix unit tests.
- **CMS-managed legal pages** (PRs #145–#148): `/privacy`, `/terms`, `/cookies`, `/accessibility` all rendered from `CmsPage` rows and editable from `/admin/pages`. Admin PATCH is an upsert against an allow-listed key set, so legal pages materialise on first save. Proxy marks all four public. Site footer (column + bottom bar) and the four inline marketing footers wired up with real `next/link` routes. **Pages are live — legal copy is the remaining pacing item.**
- **GDPR right-to-erasure** (Blocker #3 — PRs #125 + #150): `DELETE /api/customer/account` and `DELETE /api/creative/account` with shared `lib/account-deletion.ts` (soft-delete + anonymize + FK cleanup). Danger zone on both settings pages with typed-email confirm. Plus a softer **"Leave workspace"** flow (`DELETE /api/customer/members/me`) for team members who want to exit a company without nuking their account — blocks the sole OWNER from orphaning the workspace.
- **Migration automation** (PR #152): `scripts/vercel-build.mjs` runs `prisma migrate deploy` on every **production** Vercel deploy (gated on `VERCEL_ENV === "production"` so preview deploys don't apply WIP migrations to the shared demo DB). CI gains a `migrate deploy` dry-run step so a broken migration fails the PR instead of the prod deploy. See the "Migration rollback" section below for incident procedure.
- **Migration baseline squash** (PR #154): the 25 pre-existing migrations plus the 22 `db push`-introduced models (AiGeneration, Moodboard, Notification, BetterAuth tables, CMS tables, …) collapsed into a single `20260422000000_baseline` matching the current schema. CI's migrate-deploy dry-run (disabled in #152) re-enabled and green. Demo cut-over is a one-time `DELETE FROM _prisma_migrations` + `prisma migrate resolve --applied 20260422000000_baseline` (see PR body for exact commands).
- **R2 presigned-URL cache** (PR #97, pre-dates the Phase C audit): `lib/r2.ts` memoises `getSignedUrl` for 10 minutes (presigns for 20, so served URLs are always ≥ 10 min from expiry). Drop-in cache with periodic eviction + `invalidatePresignedUrlCache(storageKey)` export for delete paths. Closes the Phase C2 item from the original optimization plan.
- **`next/image` on R2 content** (PR #158): marketing surfaces now render R2-hosted images through Next's image optimizer (WebP/AVIF, responsive `sizes`, lazy by default, `priority` on article heroes) — blog / news / showcase listings + details + landing-page showcase thumbnails. Moodboard tiles intentionally skipped (canvas context + moodboard disabled for v1.0). Closes the Phase C1 item.
- **Auth hardening pass** (2026-04-23 PR): four layers of login-surface defense added as part of the pre-launch audit. **Per-email rate limit** (5 attempts / 15 min keyed on the target email, peeked from the JSON body) added on top of the existing per-IP bucket — stops an attacker rotating IPs from brute-forcing one account or DoS-ing a victim's mailbox + our Resend budget. **Password policy** raised from BetterAuth's default 8-char minimum to **12 chars + uppercase + lowercase + digit + symbol**, enforced both client-side (live checklist on sign-up + reset-password) and server-side (BetterAuth before-hook throwing `APIError("BAD_REQUEST")` on `/sign-up/email`, `/reset-password`, `/change-password`, `/set-password`). Shared rules in `lib/password-policy.ts` with a regression test suite. **Session revocation on password reset** via `emailAndPassword.revokeSessionsOnPasswordReset: true` — an attacker holding a compromised password can no longer keep a 7-day session alive after the real user resets. **Explicit cookie attributes** (`httpOnly`, `secure` in prod, `sameSite: "lax"`, `path: "/"`) so a future BetterAuth default flip can't silently weaken cookie hygiene.
- **Security Precaution Plan L1–L6** (PRs #160–#166 + TOTP upgrade): a six-layer defense around money-moving admin actions. **L1** — structured audit log (`AuditLogEntry` table) covering every money action + config change + failed auth, with a SITE_OWNER-only viewer at `/admin/audit-log`. **L2** — typed-phrase confirmation modals on grants / withdrawals / role changes. **L3** — real-time email receipts to the acting owner on every money action. **L5** — BLOCKED alerts: every failed confirmation / failed MFA / reject → rate-limited email (1/hr). **L4** — email-code MFA (6-digit, 10-min TTL, 5 attempts, hashed at rest in `MfaChallenge`, 30-minute trust window on the same action tag) in front of money actions. **L4 TOTP upgrade** — SITE_OWNERs can optionally enrol TOTP (`/admin/settings/mfa` → QR scan + confirm, stored as `UserAccount.totpSecret`); when enrolled the server returns `method: "totp"` in the 202 and the modal switches to "enter the code from your authenticator app." Reuses the same verify endpoint + trust window (via a synthetic consumed challenge row with `codeHash: "TOTP_VERIFIED"`). Free, offline-capable, no third-party cost. **L6** — 2-person approval on withdrawals ≥ `WITHDRAWAL_CO_APPROVAL_THRESHOLD_CENTS` (env var, default $500): first owner's approve lands as a pending `WithdrawalApproval` row; the UI shows an "awaiting co-approval" chip until a second owner approves, then the withdrawal marks PAID and both signatures are recorded in the audit log. Auto-bypass if `ownerCount <= 1` so a single-owner team can still ship. **Demo-mode guard** on every layer so `demo.brandbite.studio` doesn't spam real mailboxes or block persona-switching testers.

### 🟡 Partial — works in some paths, not all

- **Rate limiting**. Upstash Redis wired (`lib/rate-limit.ts`), applied to AI routes. **Not applied to `/api/auth/*`** — login and password-reset are currently unprotected from credential stuffing. _See Blocker #2 below._

### 🔴 Missing — verified absent in the codebase

- **Legal copy** for `/privacy`, `/terms`, `/cookies`, `/accessibility`. Routes + admin editor shipped (#145–#148); the actual policy text has not been authored. Needs a lawyer or a vetted template service (Termly / Iubenda).
- **App-level backup automation**. Relies entirely on Neon's point-in-time recovery — fine for v1.0 if we're on a Neon paid tier, but should be called out.
- **Migration backfill** for historical `db push` models (`AiGeneration`, `Moodboard`, `Notification`, …). Existing demo already has these tables so it's fine day-to-day, but a fresh production DB would be missing them. See the "Operational cutover" bucket.

---

## Production blockers (must land before v1.0 launch)

These are the items I'd refuse to launch without. Each is tractable in 1–2 PRs.

### Blocker #1 — Email verification on sign-up ✅ Shipped

**Shipped in #124.** `lib/better-auth.ts` enables `emailAndPassword.requireEmailVerification` + `emailVerification.sendOnSignUp` + `autoSignInAfterVerification`. Verification email sent via the same Resend helper as password reset. `/verify-email` "check your inbox" page with a resend button. Sign-in errors that look like "email not verified" route to that page with `?reason=unverified`.

### Blocker #2 — Auth rate limits ✅ Shipped + hardened

**Shipped in #124 + auth-hardening PR (2026-04-23).**

- **Per-IP bucket** (#124): `app/api/auth/[...all]/route.ts` wraps `toNextJsHandler` with an Upstash-backed rate limiter on POSTs. Two buckets: sensitive (sign-in / sign-up / forget-password / reset-password / send-verification-email / magic-link): 10/60s. General auth: 60/60s. 429 + `Retry-After` header.
- **Per-email bucket** (auth-hardening PR): a second layer keyed on the target email (parsed from the request body) on sign-in + forget-password + send-verification-email + magic-link paths. 5 attempts / 15 min. Stops an attacker rotating IPs from brute-forcing a single account or DoS'ing a victim's inbox + our Resend budget.

**Related hardening shipped in the same PR**:

- `emailAndPassword.minPasswordLength: 12` (up from BetterAuth default 8) + complexity hook (uppercase / lowercase / digit / symbol) on `/sign-up/email`, `/reset-password`, `/change-password`, `/set-password`. Client-side checklist matches via shared `lib/password-policy.ts`.
- `emailAndPassword.revokeSessionsOnPasswordReset: true` — every existing session for the user is deleted when they complete a reset. An attacker holding a compromised password can't keep a 7-day session alive after the real user resets.
- `advanced.defaultCookieAttributes`: explicit `httpOnly` + `secure` (prod only) + `sameSite: "lax"` + `path: "/"` so a future BetterAuth default change can't silently weaken cookie hygiene.

### Blocker #3 — GDPR right-to-erasure ✅ Shipped

**Shipped in #125 + #150.** Customer and creative accounts both have self-delete (`DELETE /api/customer/account`, `DELETE /api/creative/account`) with typed-email confirmation, shared soft-delete + anonymize transaction via `lib/account-deletion.ts`, and role-gated endpoints. Danger zone on both `/customer/settings` and `/creative/settings`. Site-admin self-deletion intentionally out of scope — admins are deleted by `SITE_OWNER`.

**Leave-workspace** (softer alternative) landed in #150: `DELETE /api/customer/members/me`, blocks sole-OWNER from orphaning the company, matching the existing guard in `/api/customer/members/[memberId]`.

Ledger / tickets / ratings are intentionally retained post-deletion — they are financial/audit records with tax retention rules. The `UserAccount` row is anonymized in place so they stay queryable as "Deleted user" without exposing PII.

**Follow-up (tracked, not blocker):** reference the retention-and-anonymization policy from the Privacy Policy copy when it's authored (Blocker #4).

### Blocker #4 — Legal copy for Privacy / Terms / Cookies / Accessibility

**Why it matters**: Legally required for any product that takes payment + collects data. Stripe requires Privacy + TOS. Cookie policy is required under EU ePrivacy. Accessibility statement is required under the EAA (June 2025).

**Status**: Infrastructure shipped (PRs #145–#148) — all four routes live, CMS-managed via `/admin/pages`, wired into site footer + inline footers + login consent. Remaining work is purely the copy.

**Scope**: Author the four documents (with a lawyer, not me). Paste each into `/admin/pages` on production — no redeploy needed. Add a sign-up consent checkbox linking to Privacy + TOS.

**Estimated effort**: Legal review is the pacing item. **I cannot write the legal text — this needs a lawyer or a vetted template service like Termly / Iubenda.** Paste into `/admin/pages` takes ~10 min once the copy exists.

### Blocker #5 — Health check endpoint ✅ Shipped

**Shipped in #125.** `GET /api/health` at `app/api/health/route.ts` pings Prisma (`SELECT 1`) and returns `{ ok, service, time, checks }`. 200 when healthy, 503 otherwise so a dumb uptime monitor flags it without parsing the body. Proxy marks `/api/health` public in #155. Configuring the third-party monitor (BetterStack / Upptime / Vercel built-in) remains an ops task — endpoint is ready.

### Blocker #6 — Env var audit + hardening ✅ Shipped

**Shipped in #126.** `docs/env-vars.md` lists every required env var, which environments need it, and the failure mode if it's missing. Remaining work is pasting the values into production Vercel — endpoint inventory is done.

---

## Phase D status

Updated as of 2026-04-21 — most of Phase D landed during the recent sprint.

| Item                                        | Size | Status                                                              |
| ------------------------------------------- | ---- | ------------------------------------------------------------------- |
| **D11** prompt templates per job type       | S    | ✅ Shipped (#127)                                                   |
| **D15** creative utilization dashboard      | S    | ✅ Shipped (#129)                                                   |
| **D9** creative portfolio auto-populated    | S    | ✅ Shipped (#132)                                                   |
| **D10** streaming text generation           | M    | ✅ Shipped (#131)                                                   |
| **D12** image upscaling / variations        | M    | ✅ Shipped (#133)                                                   |
| **D7** time tracking per ticket             | M    | ✅ Shipped (#134)                                                   |
| **D14** cohort retention in token-analytics | M    | ⏸️ Deferred post-v1.0 (admin insight, not customer-facing)          |
| **D18** referral / affiliate program        | L    | ⏸️ Deferred v2.0+ (needs marketing + legal alignment)               |
| **D6** real-time ticket chat                | L    | ⏸️ Deferred (build only if user feedback demands it)                |
| **Moodboard track** (D1–D5)                 | L    | ⏸️ Moodboard disabled in v1.0 launch; re-enable after user research |

---

## Deferred backlog — one place for everything parked

Grouped by track so nothing gets orphaned. Revisit this section when planning the next sprint.

### Accessibility (Phases 1–3 shipped; see docs/a11y-audit.md for what's done)

- ~~**Lighthouse CI GitHub Action**~~ ✅ Shipped (PR #153). `.github/workflows/lighthouse.yml` audits `/`, `/how-it-works`, `/login` on every PR. Thresholds are `warn` only (0.7 performance / 0.9 a11y / 0.9 best-practices / 0.9 SEO) so scores surface without failing PRs. Tighten to `error` once baseline is stable over a few PRs.
- ~~**Motion-only UI alternatives**~~ ✅ Shipped (PR #159). The active-pin `pulse` animation cuts to 0.01ms under `prefers-reduced-motion`, which turned the existing 2px static ring into a subtle cue. The reduced-motion media query now substitutes a 3px white + 5px primary double-ring so the active-pin signal is still prominent without any vestibular trigger. Other motion-bearing UI (running-timer dot, loading spinners) already have textual equivalents ("Running since …", "Loading …") so no further change needed.
- **`/accessibility` statement copy** — route + admin editor shipped (#145); the CMS row exists but body needs a drafted WCAG 2.2 AA conformance statement + complaint contact. Part of the legal-copy bundle in Blocker #4
- ~~**Form `autocomplete` audit**~~ ✅ Shipped (PR #159). Added `autoComplete="name"` to profile name edit, `"organization"` to company name + onboarding company-name, `"url"` to company website, `"off"` to the delete-account confirm email (user must type their own email as a safeguard) and the team invite-email (inviting someone else — own email autofill would be wrong). Consultation booking has no personal-info fields (uses the signed-in user).
- ~~**Session-timeout warning**~~ ✅ Shipped (PR #157). `useSessionTimeoutWarning` hook reads BetterAuth's `expiresAt` via `/api/session`, schedules an accessible `alertdialog` 2 minutes before expiry with a "Stay signed in" action that extends the session (re-hitting `/api/session` triggers BetterAuth's updateAge refresh). `/login?expired=1` shows a status banner when the countdown runs out. No-op in demo mode.
- ~~**Page `<title>` uniqueness audit**~~ ✅ Shipped (PR #159) for public marketing + auth routes. 12 new sibling `layout.tsx` files contribute metadata to the "use client" pages they wrap (blog, news, showcase, pricing, how-it-works, faq, documentation, about, contact, login, reset-password, verify-email, onboarding). Root template `"%s | Brandbite"` combines each with the brand suffix automatically. Dynamic slug routes (`/blog/[slug]`, `/news/[slug]`, `/showcase/[slug]`) + authenticated dashboards still inherit the generic `"Brandbite"` — deferred as a follow-up (dynamic routes need `generateMetadata` with a Prisma fetch; dashboards are lower-priority for SEO and screen-reader routing cues).
- **Moodboard canvas keyboard accessibility** (~M) — drag-place items, connect lines, add notes — all mouse-only today
- **Manual screen-reader walkthrough** (VoiceOver / NVDA) — human step, unreplaceable
- **Keyboard walkthrough of critical flows** — sign-in → create ticket → approve revision → sign out, note friction
- **VPAT / ACR document** — only needed for enterprise / government sales
- **Third-party formal audit** ($5–15k external, only if a specific customer requires it)

### Operational cutover (user tasks — not code)

- **AI provider keys** on demo Vercel: `OPENAI_API_KEY`, `REPLICATE_API_TOKEN` (+ optional `OPENAI_ORG_ID`) — without these, every AI tool fails at call time
- **Stripe live keys** swap: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — stay on test mode until v1.0
- **Resend sending domain** verification — `brandbite.studio` SPF + DKIM + DMARC records
- **`SENTRY_DSN`** on production — `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`
- **Legal copy** for `/privacy` + `/terms` + `/cookies` + `/accessibility` at `/admin/pages` (all four pageKeys scaffolded + routes live as of #145–#148; paste-only, no redeploy needed)
- ~~**Migration backfill**~~ ✅ Shipped (PR #154) — squashed the 25 historic migrations + 22 `db push`-introduced models into a single baseline. Fresh production DBs deploy in one `prisma migrate deploy`. Demo cut-over is a one-time task covered in the PR body.
- **Pre-launch checklist** — run through the full checklist below before announcing v1.0

### Post-v1.0 polish (from earlier sprints, still parked)

- Moodboard re-enablement (currently deferred from v1.0 launch)
- Stripe Connect for automated creative payouts (replaces manual mark-paid flow)

---

## Phased release plan

### v1.0 — "Can actually take money from strangers" (target: ~1 week once cutover tasks done)

Most of v1.0 engineering is complete (Phase D features, a11y Phases 1–3, sidebar nav, theme system). Remaining is operational cutover + legal:

**Must-land** (user tasks, mostly non-code):

- Blockers 1–6 from above (email verification ✅, auth rate limits ✅, GDPR ✅ fully closed in #150, health check ✅ already shipped; legal copy + Stripe live keys remain)
- AI provider keys on Vercel
- Resend domain verification + `EMAIL_FROM`
- `SENTRY_DSN` set, errors reach a Sentry project
- `CRON_SECRET` set, Monday payout cron verified running
- Privacy + TOS + Cookie Policy + Accessibility statement authored + pasted into `/admin/pages` (routes + editor already live via #145–#148)
- Lighthouse CI GitHub Action (prevents a11y / perf regressions post-launch)

### v1.1 — "First polish pass" (target: 2 weeks after v1.0)

- Accessibility Phase 4 deferred items — motion alternatives, `/accessibility` statement page, session-timeout warning
- Customer feedback loop wiring (in-app "report an issue")
- Housekeeping: resolve any outstanding data anomalies post-launch

### v1.2 — "Growth features"

- D14 cohort retention analytics (admin insight)
- Moodboard re-enablement (currently disabled for v1.0 — decide based on user research)

### v2.0+ — "Scale features"

- D18 referral / affiliate program
- Stripe Connect for automated creative payouts (replaces manual mark-paid)
- D6 real-time ticket chat (if user feedback demands it)
- Moodboard keyboard accessibility overhaul
- VPAT / third-party a11y audit (only if enterprise sales pipeline requires)

---

## Pre-launch checklist (the final week before v1.0)

Run through this in order. Each row is a blocker that's cheap to miss and expensive to fix under launch pressure.

### Legal + compliance

Routes + admin editor shipped in PRs #145–#148. All that remains is pasting real copy into `/admin/pages` on production.

- [ ] Privacy policy body authored + pasted at `/admin/pages` (pageKey `privacy`)
- [ ] Terms of Service body authored + pasted at `/admin/pages` (pageKey `terms`)
- [ ] Cookie Policy body authored + pasted (pageKey `cookies`) — required under EU ePrivacy
- [ ] Accessibility statement authored + pasted (pageKey `accessibility`) — WCAG 2.2 AA conformance + complaint contact
- [ ] Cookie banner UI (separate from the policy page) — if targeting EU users
- [ ] Sign-up consent checkbox linking to Privacy + TOS
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

- [ ] `DATABASE_URL` (Neon production branch, pooled — subdomain contains `-pooler`)
- [ ] `DIRECT_URL` (same Neon branch, **non-pooled** — same host as `DATABASE_URL` without `-pooler`). Required so `prisma migrate deploy` can hold a Postgres advisory lock — poolers drop session-scoped locks at transaction boundaries and the migrate step fails with P1002 otherwise.
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

## Migration rollback (when `migrate deploy` goes sideways)

The Vercel production build runs `prisma migrate deploy` before `next build`. If the migrate step fails, the build fails and the old code keeps serving — safe. If the migrate step **succeeds** but the new code has a bug, or if the migration itself was destructive, follow this sequence:

1. **Revert the code first**, not the database.
   - In Vercel, go to **Deployments** → pick the last known-good deploy → **Promote to Production**. This is instant and does not touch the DB.
   - The previous code must still be compatible with the newer DB schema. This is why destructive migrations should follow the **expand → migrate → contract** pattern (add column → backfill + start writing → remove old column in a later deploy) rather than DROP-in-one-PR. The expand step makes the new schema backward-compatible with the previous code.

2. **Only restore the database if the migration was actually destructive** (e.g. dropped a column with data, truncated a table). Use Neon's point-in-time recovery:
   - Neon console → **Branches** → create a branch from the timestamp just before the migration ran.
   - Verify the branch has the expected data, then promote it (or point `DATABASE_URL` at it). Coordinate with active sessions — users mid-transaction may see errors during the cutover.

3. **Do not edit `prisma/migrations/` after a deploy.** If a migration is broken, write a _new_ forward migration that undoes the damage. `prisma migrate resolve --rolled-back <name>` is an emergency-only tool for when a migration failed partway through; discuss before using.

4. **Post-mortem cues.** If the migration ran but deploys keep failing because the build errors, check Vercel build logs for the `[vercel-build] Applying Prisma migrations` section — everything above that line is the migrate output.

Preventative: destructive migrations (DROP COLUMN, DROP TABLE, NOT NULL on a nullable column with existing nulls) should go out in their own PR, after the code that stops using the dropped thing has already been deployed and stable for at least a week.

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
