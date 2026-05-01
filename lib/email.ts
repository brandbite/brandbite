// -----------------------------------------------------------------------------
// @file: lib/email.ts
// @purpose: Resend email client — fire-and-forget email sending for
//           notification emails. Gracefully no-ops if RESEND_API_KEY is missing.
//
//           Auth-critical: BetterAuth's sign-up / magic-link / forgot-
//           password hooks `await` this. If Resend hangs (network blip,
//           DNS, downstream slowness, or — as observed on demo — a
//           configuration that lets the SDK accept the request but never
//           returns) the auth Vercel function can hit its 10s timeout
//           and get killed mid-request. The client sees an empty 500.
//           We bound every send with an explicit timeout and swallow the
//           error so a flaky Resend can never take down auth.
// -----------------------------------------------------------------------------

import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

const FROM = process.env.EMAIL_FROM || "BrandBite <notifications@brandbite.studio>";

/** Bound how long we'll wait for Resend before giving up. The Vercel
 *  serverless function's own timeout is 10s on Hobby / 60s on Pro;
 *  5s here keeps us comfortably under either while still tolerating
 *  one slow API call. */
const SEND_TIMEOUT_MS = 5_000;

/**
 * Send a notification email. Fire-and-forget — errors are caught and logged,
 * never thrown. Silently skips if RESEND_API_KEY is not configured.
 *
 * Time-bounded: if Resend doesn't respond within SEND_TIMEOUT_MS we log
 * and return cleanly. Caller (typically a BetterAuth hook) treats the
 * send as best-effort and continues with the auth flow.
 */
export async function sendNotificationEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  if (!resend) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[email] RESEND_API_KEY not configured — skipping email");
    }
    return;
  }

  try {
    await Promise.race([
      resend.emails.send({ from: FROM, to, subject, html }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Resend send to ${to} timed out after ${SEND_TIMEOUT_MS}ms`)),
          SEND_TIMEOUT_MS,
        ),
      ),
    ]);
  } catch (err) {
    // Always swallow — auth flows + revalidation hooks treat email as
    // best-effort. The log is the operations signal.
    console.error("[email] failed to send", err);
  }
}
