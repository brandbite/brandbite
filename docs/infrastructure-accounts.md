# Brandbite — Infrastructure Account Ownership

_Living document. Update whenever an account is created, transferred, or rotated._

This document tracks **which third-party accounts own what** for Brandbite's
production infrastructure. The point is to answer "who logs in to fix X?"
without having to dig through email histories or paw at password managers.

> ⚠️ **Do not put credentials in this file.** This is just a registry of
> ownership and account identifiers. API keys, passwords, and tokens belong in
> Vercel environment variables or a password manager.

## Domains & DNS

| Domain                    | DNS hosting                                    | Notes                                                                                                                                                                        |
| ------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `brandbite.studio`        | Cloudflare — `alperertug@gmail.com` (personal) | Apex used for the production app. Long-term we want to move it under the business Cloudflare account, but DNS account ownership is independent of where the app is deployed. |
| `notify.brandbite.studio` | Same as parent domain (Cloudflare)             | Subdomain. DKIM/SPF/return-path records for Resend sending live here.                                                                                                        |

If you ever need to update DNS records (Vercel domain verification, new
subdomain, etc.) you must log in to **`alperertug@gmail.com`'s Cloudflare
account** — not the studio account.

## Cloudflare accounts

| Email                       | What lives in it                                                                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `alperertug@gmail.com`      | DNS hosting for `brandbite.studio` (and any `*.brandbite.studio` subdomain).                                                                             |
| `studiobrandbite@gmail.com` | Turnstile widget for the production app (`Brandbite Production`). Site key + secret key are configured as env vars on the brandbite-prod Vercel project. |

These accounts are intentionally separate today (the domain pre-dated the
business account). The Turnstile widget's hostname allowlist needs
`brandbite.studio` listed even though DNS is in the other account — the
widget only validates the hostname the token was issued for, not who hosts
the DNS.

To consolidate later: in `alperertug@gmail.com`'s Cloudflare → site
overview → "Move site to another account" → enter `studiobrandbite@gmail.com`.
DNS records preserved. Free → Free works without plan upgrade.

## Vercel

| Project name     | Owning team / user account      | Deploys from                           | Purpose                                                                |
| ---------------- | ------------------------------- | -------------------------------------- | ---------------------------------------------------------------------- |
| `brandbite`      | `alperertug's projects` (Hobby) | `main` branch of `brandbite/brandbite` | Demo deploy. Serves `demo.brandbite.studio`.                           |
| `brandbite-prod` | `alperertug's projects` (Hobby) | `main` branch of `brandbite/brandbite` | Production deploy. Will serve `brandbite.studio` once domain is wired. |

Both projects deploy from the same GitHub repo. Each has its own env-var set
(see `env-vars.md`). PRs build previews on **only** the demo project — prod
is configured to deploy main only, no preview deployments (or will be once
launch traffic warrants the isolation).

When team upgrade lands, both projects should move to a `brandbite` Vercel
team on Pro — Hobby tier is officially non-commercial.

## Neon (Postgres)

Project: **Brandbite** (free tier). Branches:

| Branch        | Purpose                                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------------------------- |
| `production`  | DNS-default name, but actually hosts the **demo** environment. ~36 MB of test data.                               |
| `prod`        | The real production database. Empty schema waiting for first sign-ups. Backed by endpoint `ep-fancy-waterfall-…`. |
| `development` | Unused, kept around as a sandbox for one-off SQL experiments.                                                     |

Naming is historical and confusing — the `production` branch is for demo,
the `prod` branch is for production. Don't fix the naming until we move off
free tier and can plan a clean cutover.

The `prod` branch is on Neon free tier and **auto-suspends after ~5 minutes
of idle**. First request after a quiet period takes 3–5 seconds for the
compute to wake. We mitigate with `connect_timeout=15` on
`DATABASE_URL`/`DIRECT_URL` query strings; closer to launch we should
upgrade to Neon Launch tier ($19/mo) so auto-suspend can be disabled.

## Stripe

Two contexts:

- **Sandbox / test mode** (`brandbite.studios`) — what we use for local dev
  and the prod-but-pre-launch state. Webhook configured at
  `https://brandbite-prod.vercel.app/api/billing/webhook`.
- **Live mode** — pending business verification. Once approved, we'll
  switch the env-var keys from `sk_test_…` to `sk_live_…` and create a
  separate live-mode webhook (different `whsec_…`).

The Stripe account itself is owned by `studiobrandbite@gmail.com`.

## Resend (transactional email)

Account: `studiobrandbite@gmail.com`. Verified sending domain:
`notify.brandbite.studio` (DNS records SPF/DKIM/return-path live in the
parent `brandbite.studio` Cloudflare zone in the personal account).

`EMAIL_FROM` env var on prod is set to
`BrandBite <notifications@notify.brandbite.studio>`.

## Upstash (Redis for rate-limit)

Account: `studiobrandbite@gmail.com`. Database: **Brandbite** (free tier).
Shared between demo and prod — the rate-limit key prefix isolates
environments enough that this is safe at current traffic. If usage spikes
above ~500 commands/min sustained, split into two databases (free tier
allows 1 / paid allows more).

## GitHub

Repo: [`brandbite/brandbite`](https://github.com/brandbite/brandbite). Owned
by the `brandbite` GitHub org. Branch protection enabled on `main` (admin
override allowed for solo development).

## R2 (object storage, Cloudflare)

Account: `studiobrandbite@gmail.com`. Bucket: shared between demo and prod
today. Acceptable for now because the demo doesn't store sensitive
customer files; closer to launch we should split into separate buckets so
demo cleanup operations can't accidentally touch prod assets.

## OpenAI / Replicate

Both accounts owned by `studiobrandbite@gmail.com`. No paid credits loaded
yet — AI generation routes will fail until either funded or routed
elsewhere. Decide before any public AI feature ships.

## Account-recovery cheat-sheet

If something is on fire and you need to fix DNS / the email path / the
Turnstile gate, here's where to log in:

| Symptom                                   | Account to log in as                 | Where to look                          |
| ----------------------------------------- | ------------------------------------ | -------------------------------------- |
| `brandbite.studio` not resolving          | `alperertug@gmail.com`               | Cloudflare → DNS                       |
| Verification emails not arriving          | `studiobrandbite@gmail.com`          | Resend → Logs                          |
| Signup form 403 on Turnstile check        | `studiobrandbite@gmail.com`          | Cloudflare → Turnstile → widget detail |
| Webhook not firing on a real Stripe event | `studiobrandbite@gmail.com`          | Stripe → Workbench → Webhooks          |
| Database unreachable                      | `studiobrandbite@gmail.com`          | Neon → Branches → `prod`               |
| Rate limiter behaving oddly               | `studiobrandbite@gmail.com`          | Upstash → Brandbite database           |
| Build failing on Vercel                   | `alperertug@gmail.com` (Vercel team) | Vercel → brandbite-prod → Deployments  |
