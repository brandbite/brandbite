// -----------------------------------------------------------------------------
// @file: lib/talent-notify-owners.ts
// @purpose: Fan-out helpers that email every SITE_OWNER on candidate-side
//           booking-page events the owners can't otherwise see:
//             - a candidate proposed a custom interview time
//             - a candidate's booking commit FAILED at the Google
//               Calendar step (otherwise invisible: the candidate gets a
//               502 toast, the admin queue still says "awaiting
//               candidate", and the flow silently stalls)
//
//           Mirrors the recipient-resolution pattern from
//           lib/admin-action-email.ts: query UserAccount where
//           role === "SITE_OWNER" and deletedAt is null, fire one
//           sendNotificationEmail per recipient, swallow per-recipient
//           errors so a single failure doesn't starve the rest.
//
//           Best-effort end-to-end. The triggering request's outcome
//           (proposal captured / failure response already decided) is
//           unaffected whether or not any owner gets the email; the
//           admin can still surface the state by visiting the queue.
// -----------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import { sendNotificationEmail } from "@/lib/email";
import {
  renderTalentBookingFailureNotificationEmail,
  type TalentBookingFailureNotificationEmailProps,
} from "@/lib/email-templates/talent/booking-failure-notification";
import { renderTalentProposedTimeNotificationEmail } from "@/lib/email-templates/talent/proposed-time-notification";

/** Resolve every active SITE_OWNER email. Returns [] (after logging) on
 *  query failure or bootstrap-state deploys with no owner yet. */
async function resolveOwnerEmails(context: string): Promise<string[]> {
  let owners: { email: string }[] = [];
  try {
    owners = await prisma.userAccount.findMany({
      where: { role: "SITE_OWNER", deletedAt: null },
      select: { email: true },
    });
  } catch (err) {
    console.error(`[talent-notify-owners] failed to resolve owners (${context})`, err);
    return [];
  }
  if (owners.length === 0) {
    console.warn(`[talent-notify-owners] no SITE_OWNER recipients — ${context} skipped`);
  }
  return owners.map((o) => o.email);
}

/** Send one rendered email to each owner, sequentially. Serial so log
 *  lines stay attributable when one specific recipient bounces. */
async function sendToOwners(emails: string[], subject: string, html: string): Promise<void> {
  for (const email of emails) {
    try {
      await sendNotificationEmail(email, subject, html);
    } catch (err) {
      console.error("[talent-notify-owners] send failed for", email, err);
    }
  }
}

type ProposedTimeArgs = {
  candidateName: string;
  candidateEmail: string;
  proposedIso: string;
  candidateTimezone: string;
  note?: string | null;
  /** Absolute URL into the admin panel — usually
   *  `${NEXT_PUBLIC_APP_URL}/admin/talent-applications#${row.id}`. The
   *  fragment isn't actually scrolled to today, but having the row id in
   *  the URL gives the owner a copy-pasteable identifier. */
  adminUrl: string;
};

export async function notifySiteOwnersOfProposedTime(args: ProposedTimeArgs): Promise<void> {
  const emails = await resolveOwnerEmails("proposed-time notification");
  if (emails.length === 0) return;

  let subject: string;
  let html: string;
  try {
    const rendered = await renderTalentProposedTimeNotificationEmail(args);
    subject = rendered.subject;
    html = rendered.html;
  } catch (err) {
    console.error("[talent-notify-owners] template render failed", err);
    return;
  }

  await sendToOwners(emails, subject, html);
}

/** Alert every SITE_OWNER that a candidate's booking attempt failed at
 *  the Google Calendar step. Never throws — the caller has already
 *  decided its error response and this must not change it. */
export async function notifySiteOwnersOfBookingFailure(
  args: TalentBookingFailureNotificationEmailProps,
): Promise<void> {
  const emails = await resolveOwnerEmails("booking-failure notification");
  if (emails.length === 0) return;

  let subject: string;
  let html: string;
  try {
    const rendered = await renderTalentBookingFailureNotificationEmail(args);
    subject = rendered.subject;
    html = rendered.html;
  } catch (err) {
    console.error("[talent-notify-owners] booking-failure template render failed", err);
    return;
  }

  await sendToOwners(emails, subject, html);
}
