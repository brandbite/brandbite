// -----------------------------------------------------------------------------
// @file: lib/email-templates/talent/final-confirmation.tsx
// @purpose: Sent to the candidate after the interview is *actually booked* —
//           either because they picked one of the three offered slots, or
//           because the SITE_OWNER confirmed the candidate's custom-time
//           proposal. Replaces the role the PR2 accept email used to play.
//
//           Google Calendar separately fires its own ICS invite (because
//           sendUpdates=all on createConsultationEvent); this email is the
//           branded human follow-up that the candidate gets in their inbox
//           regardless of whether they accept the calendar invite.
//
//           Rendered both for "you picked option 2" and "admin confirmed
//           your proposed time" — copy works either way without branching.
// -----------------------------------------------------------------------------

import * as React from "react";
import { render } from "@react-email/render";

import {
  BaseLayout,
  Button,
  Callout,
  Heading,
  HeroBand,
  LinkText,
  Paragraph,
  Signoff,
} from "../layout";

export type TalentFinalConfirmationEmailProps = {
  /** Recipient display name; greeting degrades gracefully if missing. */
  candidateName?: string | null;
  /** UTC ISO of the booked slot. Rendered in candidate's timezone for
   *  consistency with the calendar invite they'll also receive. */
  interviewStartIso: string;
  /** IANA timezone for slot rendering. */
  candidateTimezone: string;
  /** Google Meet URL extracted from the calendar event. Always non-null
   *  when this template is rendered — handler only fires after
   *  createConsultationEvent + extractMeetLink succeed. */
  meetLink: string;
};

function formatInterviewWhen(iso: string, timeZone: string): string {
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

export function TalentFinalConfirmationEmailTemplate({
  candidateName,
  interviewStartIso,
  candidateTimezone,
  meetLink,
}: TalentFinalConfirmationEmailProps) {
  const greeting = candidateName ? `Hi ${candidateName},` : "Hi,";
  const when = formatInterviewWhen(interviewStartIso, candidateTimezone);

  return (
    <BaseLayout
      previewText="Your Brandbite interview is booked. Here are the details."
      hero={
        <HeroBand>
          <Heading>You&apos;re booked in</Heading>
          <Paragraph>
            <strong>{greeting}</strong> All set. We&apos;ll see you at the call.
          </Paragraph>
        </HeroBand>
      }
    >
      <Callout tone="info">
        <strong>When:</strong> {when}
        <br />
        <strong>Where:</strong> <LinkText href={meetLink}>{meetLink}</LinkText>
      </Callout>

      <Paragraph>
        You&apos;ll also receive a calendar invite from Google with the same details. The invite is
        the canonical version — accept it in your calendar and you&apos;re fully set.
      </Paragraph>

      <Button href={meetLink}>Open the Meet link</Button>

      <Paragraph>
        If something changes on your end, reply to this email and we&apos;ll re-book. Schedules are
        schedules.
      </Paragraph>

      <Signoff
        preamble="Looking forward to it. If anything is unclear before the call, reply here and you'll get a real reply, not a ticket number."
        from="Alper, Brandbite"
      />
    </BaseLayout>
  );
}

export async function renderTalentFinalConfirmationEmail(
  props: TalentFinalConfirmationEmailProps,
): Promise<{ subject: string; html: string }> {
  const html = await render(<TalentFinalConfirmationEmailTemplate {...props} />);
  return {
    subject: "Your Brandbite interview is booked",
    html,
  };
}

/** Default export for `react-email dev` preview only. */
export default function TalentFinalConfirmationEmailPreview() {
  return (
    <TalentFinalConfirmationEmailTemplate
      candidateName="Jane"
      interviewStartIso="2026-05-14T11:30:00.000Z"
      candidateTimezone="Europe/Istanbul"
      meetLink="https://meet.google.com/abc-defg-hij"
    />
  );
}
