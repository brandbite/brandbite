# Security E2E Walkthrough

_A human-driven end-to-end verification of every security layer Brandbite
ships with. Run before v1.0 launch, after any PR that touches the auth,
money-action, or webhook surface, and quarterly thereafter._

---

## When to run this

- **Before v1.0 launch** — once, in full. Every test below.
- **After any PR touching** auth, MFA, withdrawals, token ledger, or the
  Stripe webhook handler — re-run the affected section.
- **Quarterly** — full suite, to catch silent regressions.
- **Before each major model upgrade / library bump** — the 10-minute smoke
  test at the top.

## Time estimates

| Scope                                 | Time                           |
| ------------------------------------- | ------------------------------ |
| Quick smoke test (§0)                 | ~10 min                        |
| Full walkthrough (§1–§12)             | ~45–60 min                     |
| With two-person co-approval test (§8) | +10 min (needs a second owner) |

## Prerequisites

- Access to **demo.brandbite.studio** (all security features are gated so
  demo doesn't spam real mailboxes; the tests below assume the demo
  environment variables documented in `docs/env-vars.md`).
- A **SITE_OWNER account** on demo with a **real email inbox you control**.
- Optional: a **second SITE_OWNER account** for §8 (co-approval). If you
  only have one, §8 auto-bypasses and you verify the bypass path instead.
- An **authenticator app** installed: Authy, 1Password, Google
  Authenticator, Bitwarden, etc.
- Access to **Neon's SQL editor** (for post-test DB verification queries).
- Optional: **Stripe CLI** for §11 webhook replay. `brew install
stripe/stripe-cli/stripe` and `stripe login` once.
- A clean browser profile (or Incognito window) to test sign-up flows
  without polluting your existing session.

## How to read a test

Each test has:

- **What it verifies** — the security promise we're checking
- **Steps** — numbered actions to take
- **Expected** — what you should see at each step
- **Verify in DB** — the SQL query that proves the server-side state
  matches what the UI showed (use Neon's SQL editor)
- **Pass criteria** — the single thing that, if true, means this test
  passed. If false, record what you saw and file a task.

## If a test fails

1. Do **not** retry blindly — capture the full state first.
2. Screenshot the UI, copy the URL, copy any error message verbatim.
3. In a terminal, grab the last ~50 lines of Vercel logs for the demo
   deployment (`vercel logs --follow` on the demo project).
4. Copy the relevant row(s) from the verification SQL.
5. File a task with title `E2E §N failed — <one-line symptom>` and attach
   the above. Do not re-run the rest of the suite until §N is fixed.

---

## §0 — Quick smoke test (10 min)

The absolute minimum before any deploy you want to trust. Full tests
below add depth but the smoke test catches the catastrophic regressions.

- [ ] **§0.1** Visit `https://demo.brandbite.studio/` — page renders.
- [ ] **§0.2** Run `curl -I https://demo.brandbite.studio/` — response
      includes `Strict-Transport-Security`, `X-Frame-Options: DENY`,
      `Content-Security-Policy`, `Cross-Origin-Opener-Policy`.
- [ ] **§0.3** Visit `/api/health` — returns `{"ok":true,...}` with
      status 200.
- [ ] **§0.4** Sign in with a known SITE_OWNER account — land on
      `/admin`.
- [ ] **§0.5** Visit `/admin/audit-log` — recent events populate.
- [ ] **§0.6** Visit `/admin/settings/mfa` — page loads, shows either
      the QR enrolment screen or the "enabled" confirmation.

If any of §0 fails, **do not proceed** — there's an infrastructure
problem that will invalidate the rest of the run.

---

## §1 — Sign-up: email verification + password policy

**What it verifies**: a new user cannot sign in without verifying their
email (Blocker #1), and the password policy blocks weak passwords both
client- and server-side (Auth Hardening PR).

### Steps

1. Open an Incognito / private browser window. Go to
   `https://demo.brandbite.studio/login`.
2. Click the "Sign up" toggle.
3. In the password field, type `password` and observe the live
   checklist.
4. Change to `Password123` (missing the symbol class).
5. Change to `Passw0rd!` (missing length).
6. Change to `Passw0rd!Passw0rd!` and submit with an email you control.
7. Page redirects to `/verify-email?email=...`.
8. Check the inbox. A `Verify your Brandbite email` email arrives
   within ~30 seconds.
9. Click the link. You land signed-in on the role-appropriate landing
   page.

### Expected

| Step | Expected                                                                 |
| ---- | ------------------------------------------------------------------------ |
| 3    | All 5 checklist rules red/outlined                                       |
| 4    | Length + digit turn green; symbol still red                              |
| 5    | Upper/lower/digit/symbol green; length red                               |
| 6    | All 5 green, submit works                                                |
| 7    | Redirect to `/verify-email`, no auto sign-in                             |
| 8    | Email from the configured `EMAIL_FROM`, branded header, one-click button |
| 9    | `emailVerified = true` in the DB; session established                    |

### Verify in DB

```sql
SELECT id, email, "emailVerified", "createdAt"
FROM "UserAccount"
WHERE email = 'YOUR_TEST_EMAIL_HERE'
ORDER BY "createdAt" DESC LIMIT 1;
```

### Pass criteria

- `emailVerified` is `true` after the email-link click.
- Steps 3–5 all show the correct failing rule in the error message
  (not just a generic "weak password").

---

## §2 — Sign-in rate limits (per-IP and per-email)

**What it verifies**: the two-layer rate limiter (Blocker #2 + Auth
Hardening PR) blocks brute-force from a single IP and from an attacker
rotating IPs against one account.

### Steps

#### §2.1 — Per-IP (10 attempts / 60s on sensitive paths)

1. Sign out. From the login page, attempt sign-in with a wrong password
   for an existing account. Do this **10 times in a row**, as fast as
   you can click.
2. On the 11th attempt, the response should be HTTP 429 with error:
   "Too many attempts from this IP…".

#### §2.2 — Per-email (5 attempts / 15 min on email-targeted paths)

1. Use the "Forgot password" flow. Submit it **5 times** with the same
   email address (quickly).
2. The 6th submit should 429 with: "Too many attempts for this email.
   Wait 15 minutes…".
3. Wait ~16 minutes OR manually clear the rate-limit key from Upstash
   (`auth:email:<lowercased-email>`).

### Expected

- 10 sensitive attempts pass the gate; 11th is 429 with a
  `Retry-After` header ≥ 1.
- 5 email-targeted attempts pass; 6th is 429 with `Retry-After` ≥ 1.
- Other unrelated users logging in from different IPs are **not**
  affected.

### Pass criteria

- Both rate limits actually 429.
- No part of the app becomes globally locked (verify by signing in
  from a different device / network).

---

## §3 — CMS HTML sanitization (stored-XSS prevention, A1 + dompurify CVE fix)

**What it verifies**: `components/ui/safe-html.tsx` + DOMPurify 3.4+
strip dangerous tags from admin-authored CMS content on `/blog`,
`/news`, `/showcase`, `/docs`, and the legal pages.

### Steps

1. Sign in as SITE_OWNER. Go to `/admin/pages`.
2. Open any page (e.g. `privacy`). Into the body field paste:

   ```html
   <h1>Test heading</h1>
   <p>Legitimate paragraph.</p>
   <script>
     alert("xss");
   </script>
   <img src="x" onerror="alert('xss-img')" />
   <a href="javascript:alert('xss-a')">link</a>
   <iframe src="https://evil.example.com"></iframe>
   ```

3. Save the page.
4. In a fresh incognito tab, visit the public `/privacy` route.

### Expected

- The heading and paragraph render normally.
- **No JavaScript alert** appears.
- Inspecting the rendered HTML: `<script>`, `<iframe>`, and the
  `onerror` / `javascript:` attributes are stripped.
- The `<a>` tag may remain but with the `href` removed or made safe.

### Pass criteria

- Zero script execution. If any of the four injection attempts fires
  an alert, this is a critical failure — stop the walkthrough and
  escalate.

### Cleanup

- Remove the test paragraphs from the CMS so the next visitor to
  `/privacy` doesn't see them.

---

## §4 — L4 MFA via email (first-time owner)

**What it verifies**: money-moving actions for a SITE_OWNER **without**
TOTP enrolled prompt for an email-delivered 6-digit code, enforce a
10-minute TTL and 5-attempt cap, and unlock a 30-minute trust window on
success.

### Steps

1. Sign in as SITE_OWNER who has **not** enrolled TOTP.
   (Confirm at `/admin/settings/mfa` — should show the enrol-QR screen.)
2. Go to `/admin/companies`. Pick a company and click
   "Adjust tokens". Enter `+50` and submit.
3. A modal appears: "Security check" with message about emailing a code.
4. Check the SITE_OWNER's inbox. A code arrives.
5. **Test wrong code first**: enter `000000`. Modal shows "Invalid
   code" and an attempt counter decrements.
6. Enter the real code. Modal closes, adjustment completes. Balance
   updates in the UI.
7. Within 30 min, adjust tokens for a **different** company. Modal
   should **not** prompt for MFA — the trust window is active.
8. Wait 31+ min. Adjust tokens again. Modal prompts for a fresh code.

### Expected

| Step | Expected                                                    |
| ---- | ----------------------------------------------------------- |
| 3    | Modal with masked email, 10-min expiry                      |
| 5    | Attempt counter drops by 1, no code re-sent                 |
| 6    | Success; `TokenLedger` row created; audit log entry written |
| 7    | Silent success (no MFA prompt)                              |
| 8    | Fresh MFA prompt (new challenge)                            |

### Verify in DB

```sql
-- The consumed challenge and its age
SELECT id, "actionTag", "consumedAt", attempts, "expiresAt"
FROM "MfaChallenge"
WHERE "userId" = 'YOUR_OWNER_ID'
ORDER BY "createdAt" DESC LIMIT 3;

-- The ledger row and audit entry for the grant
SELECT id, direction, amount, reason, metadata, "createdAt"
FROM "TokenLedger"
WHERE metadata::jsonb @> '{"companyId": "TARGET_COMPANY_ID"}'
ORDER BY "createdAt" DESC LIMIT 1;

SELECT id, "actorId", action, entity, "entityId", "createdAt"
FROM "AdminActionLog"
WHERE "actorId" = 'YOUR_OWNER_ID'
ORDER BY "createdAt" DESC LIMIT 5;
```

### Pass criteria

- Wrong code is rejected without sending a new email.
- After 5 wrong attempts, the challenge locks (`attempts = 5` in DB).
- Right code unlocks the action, writes the ledger row, and writes an
  audit log entry.
- Second money action within 30 min does not re-prompt.

---

## §5 — L4 MFA via TOTP (authenticator app upgrade, PR #167)

**What it verifies**: enrolment flow, TOTP code path replaces email,
disable flow falls back to email.

### Steps

1. Go to `/admin/settings/mfa`.
2. Scan the QR code with your authenticator app.
3. Enter the live 6-digit code the app displays. Submit.
4. Page switches to "Authenticator app enabled" confirmation.
5. Adjust tokens on a company.
6. Modal should now say **"Open your authenticator app…"** (not
   "We emailed a code").
7. Enter the current code from the app. Action completes.
8. Click "Disable authenticator app". Confirm.
9. Adjust tokens again → modal switches back to email flow.

### Expected

| Step | Expected                                                               |
| ---- | ---------------------------------------------------------------------- |
| 3    | If code is wrong, server rejects without persisting the secret         |
| 4    | DB shows `UserAccount.totpSecret` populated                            |
| 6    | Modal copy explicitly mentions authenticator app                       |
| 7    | Synthetic `MfaChallenge` row written with `codeHash = 'TOTP_VERIFIED'` |
| 8    | `totpSecret` and `totpEnrolledAt` nulled                               |
| 9    | Back to email-code path                                                |

### Verify in DB

```sql
SELECT id, email, "totpSecret" IS NOT NULL AS has_totp, "totpEnrolledAt"
FROM "UserAccount"
WHERE id = 'YOUR_OWNER_ID';

-- Synthetic TOTP challenge rows after step 7
SELECT id, "codeHash", "consumedAt", attempts
FROM "MfaChallenge"
WHERE "userId" = 'YOUR_OWNER_ID' AND "codeHash" = 'TOTP_VERIFIED'
ORDER BY "createdAt" DESC LIMIT 3;
```

### Pass criteria

- Enrolment persists the secret only after code verification.
- TOTP path writes a `TOTP_VERIFIED` challenge so the trust-window
  query still catches it.
- Disable fully removes the secret.

---

## §6 — L3 Email receipts

**What it verifies**: every money action fires a receipt email to the
acting owner (fire-and-forget, 1 per action, not digested).

### Steps

1. Perform any money action from §4 or §5 above.
2. Check the SITE_OWNER's inbox within 2 minutes.

### Expected

- A receipt email arrives with subject describing the action
  (e.g. "Brandbite: Grant 50 tokens to <Company>").
- Body includes actor name, action details, timestamp, IP, and a link
  to `/admin/audit-log`.
- The receipt does **not** block the action if Resend is slow — the
  action completes independently.

### Pass criteria

- One email per action, not batched, within 2 min.
- Receipt arrives even if the action was triggered by a different
  owner (addressed to the actor).

---

## §7 — L5 BLOCKED alerts

**What it verifies**: failed confirmations / failed MFA / rejections
produce a BLOCKED alert email, rate-limited to 1/hr per owner to avoid
email-storm self-DoS.

### Steps

1. Attempt a money action.
2. In the typed-phrase confirmation modal, type a **wrong phrase** and
   submit. Action is rejected.
3. Within 2 minutes the SITE_OWNER receives a "⚠️ Blocked admin action"
   email.
4. Repeat step 2 immediately with the same or a different action.
5. No second email arrives (rate-limited).
6. Wait 61+ minutes. Repeat step 2. Second BLOCKED email arrives.

### Expected

- One BLOCKED email per hour, not one per failure.
- Email subject makes the BLOCKED nature obvious (alert icon / "Blocked"
  in subject).
- Email body includes the failed action, actor, IP, user agent.

### Pass criteria

- First failure → email. Second within the hour → no email.
  After hour rollover → email again.

---

## §8 — L6 Two-person approval on large withdrawals

**What it verifies**: withdrawals ≥ `WITHDRAWAL_CO_APPROVAL_THRESHOLD_CENTS`
require a second owner's approval; single-owner demo auto-bypasses.

### §8a — Two owners available

1. Sign in as Owner A. Go to `/admin/withdrawals`.
2. Find (or create a test) withdrawal ≥ $500.
3. Click "Approve". Complete MFA.
4. UI should show "Awaiting co-approval" chip on the row. Withdrawal
   status remains PENDING.
5. Sign out. Sign in as Owner B in a different browser / incognito.
6. Approve the same withdrawal.
7. Withdrawal flips to PAID. Both signatures recorded in audit log.

### §8b — Single-owner fallback

If only one SITE_OWNER exists on demo:

1. Approve a ≥ $500 withdrawal.
2. It completes immediately (no "Awaiting co-approval" state).
3. Audit log shows the approval was auto-bypassed with reason
   "ownerCount <= 1".

### Verify in DB

```sql
SELECT id, "withdrawalId", "approverId", "approvedAt", reason
FROM "WithdrawalApproval"
WHERE "withdrawalId" = 'TARGET_WITHDRAWAL_ID'
ORDER BY "approvedAt";

SELECT id, status
FROM "Withdrawal"
WHERE id = 'TARGET_WITHDRAWAL_ID';
```

### Pass criteria

- Two-owner path: first approve → PENDING + "awaiting" chip. Second
  approve → PAID, both signatures in `WithdrawalApproval`.
- One-owner path: no UI changes, withdrawal PAID, audit log notes
  auto-bypass.

---

## §9 — Session revocation on password reset

**What it verifies**: `emailAndPassword.revokeSessionsOnPasswordReset`
actually invalidates other sessions when a user resets their password.

### Steps

1. Sign in with the same account on two browsers (browser A and
   incognito B).
2. From browser A, trigger "Forgot password" → click email link →
   set a new password.
3. In browser A, you remain signed in (fresh session from the reset).
4. Switch to browser B. Navigate anywhere authenticated. You should be
   redirected to `/login`.

### Verify in DB

```sql
-- Sessions for this user before and after. After reset, only one row
-- should remain (the browser that did the reset).
SELECT id, "userId", "expiresAt", "createdAt"
FROM "Session"
WHERE "userId" = 'YOUR_USER_ID'
ORDER BY "createdAt" DESC;
```

### Pass criteria

- Browser B is logged out after browser A's reset completes.
- Only the new session (from browser A's reset) remains in the DB.

---

## §10 — Security headers on production responses

**What it verifies**: `next.config.ts` security headers actually ship
with every response.

### Steps

```bash
curl -sI https://demo.brandbite.studio/ | grep -iE \
  'strict-transport|x-frame|x-content|referrer|permissions-policy|content-security|cross-origin-opener|x-permitted'
```

### Expected headers (all present)

- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Cross-Origin-Opener-Policy: same-origin`
- `X-Permitted-Cross-Domain-Policies: none`
- `Content-Security-Policy:` (long, contains `form-action 'self'`,
  `frame-ancestors 'none'`, `upgrade-insecure-requests`)

### Pass criteria

All 8 headers present. If any is missing, the CDN / Vercel may be
stripping it — check the Vercel project's "Headers" pane.

---

## §11 — Stripe webhook idempotency

**What it verifies**: PR #171 — a replayed Stripe webhook is a 200 OK
no-op, not a double-credit.

### Requires: Stripe CLI (`stripe login` + pointed at the test-mode

account). If you don't have this, skip — the 6 integration tests in
`tests/integration/stripe-webhook-idempotency.test.ts` cover the same
property in CI.

### Steps

1. From a terminal: `stripe listen --forward-to https://demo.brandbite.studio/api/billing/webhook`
2. Trigger a test event:
   ```bash
   stripe trigger invoice.payment_succeeded
   ```
3. Grab the event ID from the CLI output (e.g. `evt_1ABC...`).
4. Query the DB to confirm the dedup row was written:
   ```sql
   SELECT * FROM "ProcessedStripeEvent" WHERE "eventId" = 'evt_1ABC...';
   ```
5. Replay the same event via the CLI:
   ```bash
   stripe events resend evt_1ABC...
   ```
6. Demo logs should show `[billing.webhook] duplicate event, skipping
handler`.
7. Query `TokenLedger` — there should be **one** new row from step 2,
   **not two** after step 5.

### Pass criteria

- Second delivery returns 200 with `{ duplicate: true }` in the body.
- `TokenLedger` was only mutated once.

---

## §12 — Demo-mode guardrails

**What it verifies**: `isDemoMode()` branches correctly — persona
switching works on demo, the auth path still works, and none of the
security-layer emails (L3/L5/verification/MFA) actually fire out when
`DEMO_MODE=true`.

### Steps

1. On demo, use the demo-persona switcher at `/debug/demo-user` to
   swap between CUSTOMER / SITE_OWNER / DESIGNER personas.
2. Trigger a money action as the demo SITE_OWNER.
3. No MFA prompt should appear (bypassed on demo).
4. No email should arrive (receipts + BLOCKED all guarded by
   `isDemoMode()`).
5. Attempt to access `/debug/demo-user` on **production** (if you have
   a separate prod env). Should 404 / hard-redirect.

### Pass criteria

- Demo: persona switch works, actions complete without MFA / email
  noise.
- Prod: demo switcher is inaccessible. (Verify via the boot-time
  assertion in `instrumentation.ts` — if `DEMO_MODE=true` on
  production, the build itself should throw.)

---

## Sign-off

On successful completion, fill in this block and archive the page (screenshot to the team channel, commit a dated copy to `/docs/e2e-logs/`, or paste into your project tracker).

```
Walkthrough date:    YYYY-MM-DD
Environment:         demo.brandbite.studio
Run by:              <name>
Sections skipped:    <list, with reason>
Sections failed:     <list, with linked task IDs>
Overall result:      [ ] PASS  [ ] FAIL  [ ] PASS-WITH-NOTES
Next scheduled run:  YYYY-MM-DD
```

## Appendix — Where each test maps to the codebase

| Test | Primary files                                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------- |
| §1   | `lib/better-auth.ts`, `app/login/page.tsx`, `app/verify-email/page.tsx`, `lib/password-policy.ts`                   |
| §2   | `app/api/auth/[...all]/route.ts`, `lib/rate-limit.ts`                                                               |
| §3   | `components/ui/safe-html.tsx`, `app/privacy/page.tsx`, DOMPurify 3.4+                                               |
| §4   | `lib/mfa.ts`, `components/admin/mfa-challenge-modal.tsx`, `app/api/admin/mfa/verify/route.ts`                       |
| §5   | `app/admin/settings/mfa/page.tsx`, `app/api/admin/mfa/enroll/route.ts`, `lib/mfa.ts` (TOTP helpers)                 |
| §6   | `lib/email.ts`, money-action route handlers                                                                         |
| §7   | `lib/email.ts` (BLOCKED sender), `lib/rate-limit.ts`                                                                |
| §8   | `app/admin/withdrawals/page.tsx`, `app/api/admin/withdrawals/route.ts`, `prisma/schema.prisma` (WithdrawalApproval) |
| §9   | `lib/better-auth.ts` (`revokeSessionsOnPasswordReset: true`)                                                        |
| §10  | `next.config.ts` (securityHeaders)                                                                                  |
| §11  | `lib/stripe-webhook-idempotency.ts`, `app/api/billing/webhook/route.ts`                                             |
| §12  | `lib/demo.ts` (or wherever `isDemoMode()` lives), `instrumentation.ts`                                              |

---

_Keep this document short of human names and specific emails. It will
be committed to the repo and visible to every future contributor —
treat it as public documentation._
