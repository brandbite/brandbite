// -----------------------------------------------------------------------------
// @file: lib/email-templates/talent/proposed-time-notification.tsx
// @purpose: Internal notification to every SITE_OWNER when a candidate
//           clicks "none of these work" on the public booking page and
//           proposes their own time. Tells the owner who the candidate is,
//           what they proposed, any short note they left, and links
//           straight to the admin detail panel where the owner can
//           confirm-as-is (creating the calendar event) or counter-propose.
//
//           Recipient resolution mirrors lib/admin-action-email.ts —
//           query every UserAccount where role === "SITE_OWNER" and
//           deletedAt is null, fire one email per recipient, swallow
//           per-recipient errors so a stale Resend hiccup doesn't
//           starve the surviving owners. Best-effort end-to-end.
// -----------------------------------------------------------------------------

import * as React from "react";
import { render } from "@react-email/render";

import { BaseLayout, Button, Callout, Heading, HeroBand, Paragraph, Signoff } from "../layout";

export type TalentProposedTimeNotificationEmailProps = {
  /** Display name of the candidate (from the original application). */
  candidateName: string;
  /** Candidate's email — visible so the owner can sanity-check before
   *  acting; not a CTA target. */
  candidateEmail: string;
  /** ISO instant the candidate proposed. */
  proposedIso: string;
  /** Candidate's IANA timezone — render the proposed time in their TZ
   *  so the owner sees the same string the candidate did when picking. */
  candidateTimezone: string;
  /** Optional short note the candidate left in the propose form. */
  note?: string | null;
  /** Deep link to the admin detail panel for this application. The
   *  panel surfaces a "Confirm proposed time" button that triggers the
   *  ACCEPT_PROPOSED action server-side. */
  adminUrl: string;
};

function formatProposed(iso: string, timeZone: string): string {
  try {
    const d = new Date(iso);
    const fmt = new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone,
    });
    return `${fmt.format(d)} (${timeZone})`;
  } catch {
    return `${iso} (${timeZone})`;
  }
}

export function TalentProposedTimeNotificationEmailTemplate({
  candidateName,
  candidateEmail,
  proposedIso,
  candidateTimezone,
  note,
  adminUrl,
}: TalentProposedTimeNotificationEmailProps) {
  const trimmedNote = note?.trim() || null;
  const when = formatProposed(proposedIso, candidateTimezone);

  return (
    <BaseLayout
      previewText={`${candidateName} proposed a custom interview time.`}
      hero={
        <HeroBand>
          <Heading>A candidate proposed a different time</Heading>
          <Paragraph>
            None of the three slots you offered worked, so the candidate suggested their own.
          </Paragraph>
        </HeroBand>
      }
    >
      <Callout tone="info">
        <strong>Candidate:</strong> {candidateName} &middot; {candidateEmail}
        <br />
        <strong>Proposed:</strong> {when}
      </Callout>

      {trimmedNote && (
        <Paragraph>
          <em>&ldquo;{trimmedNote}&rdquo;</em>
        </Paragraph>
      )}

      <Paragraph>
        Open the admin panel to confirm this time (creates the Google Calendar event and sends the
        candidate the final confirmation), or offer three new slots.
      </Paragraph>

      <Button href={adminUrl}>Review in admin</Button>

      <Signoff
        preamble="Replying to this email goes nowhere — use the admin panel to act."
        from="Brandbite ops"
      />
    </BaseLayout>
  );
}

export async function renderTalentProposedTimeNotificationEmail(
  props: TalentProposedTimeNotificationEmailProps,
): Promise<{ subject: string; html: string }> {
  const html = await render(<TalentProposedTimeNotificationEmailTemplate {...props} />);
  return {
    subject: `${props.candidateName} proposed a custom interview time`,
    html,
  };
}

/** Default export for `react-email dev` preview only. */
export default function TalentProposedTimeNotificationEmailPreview() {
  return (
    <TalentProposedTimeNotificationEmailTemplate
      candidateName="Jane Designer"
      candidateEmail="jane@example.com"
      proposedIso="2026-05-20T14:00:00.000Z"
      candidateTimezone="Europe/Istanbul"
      note="None of the morning slots work for me — could we do afternoon next week?"
      adminUrl="https://brandbite.studio/admin/talent-applications#example"
    />
  );
}
