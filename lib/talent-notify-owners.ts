// -----------------------------------------------------------------------------
// @file: lib/talent-notify-owners.ts
// @purpose: Fan-out helper that emails every SITE_OWNER when a candidate
//           proposes a custom interview time on the public booking page.
//
//           Mirrors the recipient-resolution pattern from
//           lib/admin-action-email.ts: query UserAccount where
//           role === "SITE_OWNER" and deletedAt is null, fire one
//           sendNotificationEmail per recipient, swallow per-recipient
//           errors so a single failure doesn't starve the rest.
//
//           Best-effort end-to-end. The candidate's commit (the row
//           moving to CANDIDATE_PROPOSED_TIME) succeeds whether or not
//           any owner gets the email; the admin can still surface the
//           proposal by visiting the admin queue directly.
// -----------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";
import { sendNotificationEmail } from "@/lib/email";
import { renderTalentProposedTimeNotificationEmail } from "@/lib/email-templates/talent/proposed-time-notification";

type Args = {
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

export async function notifySiteOwnersOfProposedTime(args: Args): Promise<void> {
  let owners: { email: string }[] = [];
  try {
    owners = await prisma.userAccount.findMany({
      where: { role: "SITE_OWNER", deletedAt: null },
      select: { email: true },
    });
  } catch (err) {
    console.error("[talent-notify-owners] failed to resolve owners", err);
    return;
  }

  if (owners.length === 0) {
    // Likely a bootstrap-state deploy where no SITE_OWNER exists yet.
    // Nothing actionable from here — log so an operator can spot the gap.
    console.warn(
      "[talent-notify-owners] no SITE_OWNER recipients — proposed-time notification skipped",
    );
    return;
  }

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

  // Fire per-recipient sequentially. sendNotificationEmail is itself
  // best-effort + time-bounded; running serially keeps log lines
  // attributable when one specific recipient bounces.
  for (const owner of owners) {
    try {
      await sendNotificationEmail(owner.email, subject, html);
    } catch (err) {
      console.error("[talent-notify-owners] send failed for", owner.email, err);
    }
  }
}
