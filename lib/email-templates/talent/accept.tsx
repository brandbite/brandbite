// -----------------------------------------------------------------------------
// @file: lib/email-templates/talent/accept.tsx
// @purpose: Confirmation email sent to a talent applicant after the SITE_OWNER
//           accepts their application. Google Calendar separately sends the
//           ICS invite + Meet link via sendUpdates=all on the event create
//           call (lib/google/calendar.ts:createConsultationEvent), so this
//           email is the human, branded follow-up — not the calendar add.
//
//           Brand voice: warm, specific, no corporate throat-clearing. Mirrors
//           the welcome email's tone. Says exactly what's been booked and
//           when, links to the Meet, gives the candidate a clear next step
//           (look out for the calendar invite, optionally reply if the slot
//           doesn't actually work).
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

export type TalentAcceptEmailProps = {
  /** Recipient display name; greeting degrades gracefully if missing. */
  candidateName?: string | null;
  /** ISO start time of the interview. Rendered in the candidate's own
   *  timezone — the form captured `timezone`, the API passes it back
   *  here so the rendered string matches what they'll see in Calendar. */
  interviewStartIso: string;
  /** IANA timezone (e.g. "Europe/Istanbul") used to format the date.
   *  Matches the candidate's submitted timezone. */
  candidateTimezone: string;
  /** Google Meet URL extracted from the calendar event. Always non-null
   *  when this template is rendered — the API only fires this email
   *  after createConsultationEvent + extractMeetLink succeed. */
  meetLink: string;
};

/** Date format: "Wednesday, May 14 2026 at 14:30 (Europe/Istanbul)".
 *  Intl.DateTimeFormat handles the timezone conversion + locale-correct
 *  ordering. We bail to a plain ISO render only if the timezone string
 *  is invalid, which the form's <select> shouldn't allow. */
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

export function TalentAcceptEmailTemplate({
  candidateName,
  interviewStartIso,
  candidateTimezone,
  meetLink,
}: TalentAcceptEmailProps) {
  const greeting = candidateName ? `Hi ${candidateName},` : "Hi,";
  const when = formatInterviewWhen(interviewStartIso, candidateTimezone);

  return (
    <BaseLayout
      previewText="Your Brandbite interview is booked. Here are the details."
      hero={
        <HeroBand>
          <Heading>You&apos;re through to the next round</Heading>
          <Paragraph>
            <strong>{greeting}</strong> Thanks for applying. We&apos;d like to chat in person.
          </Paragraph>
        </HeroBand>
      }
    >
      <Paragraph>
        We loved your portfolio. The next step is a short 30-minute video call so we can get to know
        you, hear how you work, and answer any questions you have about Brandbite.
      </Paragraph>

      <Callout tone="info">
        <strong>When:</strong> {when}
        <br />
        <strong>Where:</strong> <LinkText href={meetLink}>{meetLink}</LinkText>
      </Callout>

      <Paragraph>
        You&apos;ll also receive a calendar invite from Google with the same details. The invite is
        the canonical version. If you accept it in your calendar, you&apos;re all set.
      </Paragraph>

      <Button href={meetLink}>Open the Meet link</Button>

      <Paragraph>
        If the slot really doesn&apos;t work for you, just reply to this email with two or three
        windows that do and we&apos;ll re-book. No need to apologise. Schedules are schedules.
      </Paragraph>

      <Signoff
        preamble={
          <>
            Looking forward to it. If anything is unclear before the call, reply here and
            you&apos;ll get a real reply, not a ticket number.
          </>
        }
        from="Alper, Brandbite"
      />
    </BaseLayout>
  );
}

export async function renderTalentAcceptEmail(
  props: TalentAcceptEmailProps,
): Promise<{ subject: string; html: string }> {
  const html = await render(<TalentAcceptEmailTemplate {...props} />);
  return {
    subject: "You're through to the next round at Brandbite",
    html,
  };
}

/** Default export so `react-email dev` renders the template in the
 *  preview sidebar. Never called from production. */
export default function TalentAcceptEmailPreview() {
  return (
    <TalentAcceptEmailTemplate
      candidateName="Jane"
      interviewStartIso="2026-05-14T11:30:00.000Z"
      candidateTimezone="Europe/Istanbul"
      meetLink="https://meet.google.com/abc-defg-hij"
    />
  );
}
