// -----------------------------------------------------------------------------
// @file: lib/email.ts
// @purpose: Resend email client — fire-and-forget email sending for
//           notification emails. Gracefully no-ops if RESEND_API_KEY is missing.
// -----------------------------------------------------------------------------

import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

const FROM =
  process.env.EMAIL_FROM || "BrandBite <notifications@brandbite.studio>";

/**
 * Send a notification email. Fire-and-forget — errors are caught and logged,
 * never thrown. Silently skips if RESEND_API_KEY is not configured.
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
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.error("[email] failed to send", err);
  }
}
