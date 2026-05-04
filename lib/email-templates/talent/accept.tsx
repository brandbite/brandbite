// -----------------------------------------------------------------------------
// @file: lib/email-templates/talent/accept.tsx
// @purpose: First email after the SITE_OWNER accepts a talent application.
//           Replaces the PR2 "your interview is booked" email — under the
//           PR4 self-service flow we no longer book the calendar event up
//           front. Instead this email offers the candidate three time
//           slots and a "none of these work?" link to propose their own.
//
//           The `bookingUrl` is the tokenized link to
//           /talent/schedule/[token]. The candidate clicks one of the
//           three slot buttons (which deep-link to the same page with
//           ?slot=N pre-selected) or the "propose another time" link.
//           Either path lands them on the public booking page where the
//           commit happens.
//
//           Brand voice: warm, specific, no corporate throat-clearing.
//           The optional admin-supplied `customMessage` renders verbatim
//           above the slot offer so the SITE_OWNER can soft-tailor.
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
  /** Three ISO instants — the slots the SITE_OWNER picked. Rendered in
   *  the candidate's own timezone so the displayed times match what
   *  they'll see when clicking through to the booking page. */
  proposedSlotsIso: string[];
  /** IANA timezone (e.g. "Europe/Istanbul") for slot rendering. Comes
   *  from the candidate's submitted timezone. */
  candidateTimezone: string;
  /** Tokenized booking URL — `/talent/schedule/[token]`. Each "Choose"
   *  link below appends `?slot=N` so the page deep-links to the
   *  pre-selected slot. */
  bookingUrl: string;
  /** Optional verbatim note from the admin — e.g. "Loved your motion
   *  reel — really excited to chat." Null/empty = no note shown. */
  customMessage?: string | null;
};

/** Date format: "Wednesday, May 14 2026 at 14:30 (Europe/Istanbul)".
 *  Falls back to a plain ISO render if the timezone string is invalid
 *  (the form's <select> shouldn't allow that, but defensive). */
function formatSlot(iso: string, timeZone: string): string {
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
    return fmt.format(d);
  } catch {
    return iso;
  }
}

export function TalentAcceptEmailTemplate({
  candidateName,
  proposedSlotsIso,
  candidateTimezone,
  bookingUrl,
  customMessage,
}: TalentAcceptEmailProps) {
  const greeting = candidateName ? `Hi ${candidateName},` : "Hi,";
  const trimmedNote = customMessage?.trim() || null;

  return (
    <BaseLayout
      previewText="Pick a time for your Brandbite interview."
      hero={
        <HeroBand>
          <Heading>You&apos;re through to the next round</Heading>
          <Paragraph>
            <strong>{greeting}</strong> Thanks for applying. We&apos;d like to chat in person.
          </Paragraph>
        </HeroBand>
      }
    >
      {trimmedNote ? (
        <Paragraph>
          <em>{trimmedNote}</em>
        </Paragraph>
      ) : (
        <Paragraph>
          We loved your portfolio. The next step is a short 30-minute video call so we can get to
          know you, hear how you work, and answer any questions you have.
        </Paragraph>
      )}

      <Callout tone="info">
        Pick a slot that works for you. Times are shown in <strong>{candidateTimezone}</strong>.
      </Callout>

      {proposedSlotsIso.map((iso, idx) => (
        <Paragraph key={iso}>
          <strong>Option {idx + 1}:</strong> {formatSlot(iso, candidateTimezone)} &middot;{" "}
          <LinkText href={`${bookingUrl}?slot=${idx}`}>Choose this slot</LinkText>
        </Paragraph>
      ))}

      <Button href={bookingUrl}>See all options &amp; book</Button>

      <Paragraph>
        None of these work for you?{" "}
        <LinkText href={`${bookingUrl}?propose=1`}>Propose a time that does</LinkText>. We&apos;ll
        do our best to make it happen.
      </Paragraph>

      <Signoff
        preamble="The booking link expires in 7 days. After you pick (or propose), you'll get a final confirmation with the Google Meet link."
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
    subject: "Pick a time for your Brandbite interview",
    html,
  };
}

/** Default export for `react-email dev` preview only. */
export default function TalentAcceptEmailPreview() {
  return (
    <TalentAcceptEmailTemplate
      candidateName="Jane"
      proposedSlotsIso={[
        "2026-05-14T11:30:00.000Z",
        "2026-05-15T13:00:00.000Z",
        "2026-05-16T09:00:00.000Z",
      ]}
      candidateTimezone="Europe/Istanbul"
      bookingUrl="https://brandbite.studio/talent/schedule/EXAMPLE_TOKEN"
      customMessage="Loved your motion reel — really excited to chat."
    />
  );
}
