// -----------------------------------------------------------------------------
// @file: lib/email-templates/talent/booking-failure-notification.tsx
// @purpose: Internal alert to every SITE_OWNER when the candidate-side
//           booking commit (POST /api/talent/schedule/[token]/pick) fails
//           at the Google Calendar step. Without this email the failure is
//           invisible from the inside: the candidate sees a 502 toast on
//           the public page, the admin queue still says "awaiting
//           candidate", and nobody knows the flow is stuck until the
//           candidate writes in (incident of 2026-06: an expired Google
//           OAuth refresh token silently failed every pick attempt).
//
//           Stage-specific guidance because the three failure modes have
//           three different fixes:
//             GOOGLE_NOT_CONNECTED   → connect Calendar in admin settings
//             CALENDAR_CREATE_FAILED → usually expired/revoked token; reconnect
//             MEET_LINK_MISSING      → event exists but no Meet link came back;
//                                      also leaves an orphan event to clean up
//
//           Recipient resolution + send loop live in
//           lib/talent-notify-owners.ts (same pattern as the
//           proposed-time notification).
// -----------------------------------------------------------------------------

import * as React from "react";
import { render } from "@react-email/render";

import { BaseLayout, Button, Callout, Heading, HeroBand, Paragraph, Signoff } from "../layout";

export type TalentBookingFailureStage =
  | "GOOGLE_NOT_CONNECTED"
  | "CALENDAR_CREATE_FAILED"
  | "MEET_LINK_MISSING";

export type TalentBookingFailureNotificationEmailProps = {
  /** Display name of the candidate (from the application row). */
  candidateName: string;
  /** Candidate's email so the owner can reach out directly if needed. */
  candidateEmail: string;
  /** ISO instant of the slot the candidate tried to book. */
  slotIso: string;
  /** Candidate's IANA timezone — render the slot the way they saw it. */
  candidateTimezone: string;
  /** Which step of the booking commit failed. */
  stage: TalentBookingFailureStage;
  /** Short technical detail (error message), already truncated by the
   *  caller. Null for stages with nothing useful to quote. */
  detail?: string | null;
  /** Deep link to the consultation settings page where the Google
   *  connection is managed — the fix for the two common stages. */
  settingsUrl: string;
  /** Deep link to the admin talent queue for context on the row. */
  adminUrl: string;
};

const STAGE_COPY: Record<TalentBookingFailureStage, { what: string; fix: string }> = {
  GOOGLE_NOT_CONNECTED: {
    what: "Google Calendar is not connected, so the interview event could not be created.",
    fix: "Connect Google Calendar in the consultation settings, then ask the candidate to open their booking link again — it stays valid until its expiry date.",
  },
  CALENDAR_CREATE_FAILED: {
    what: "Google rejected the calendar event create. The most common cause is an expired or revoked OAuth connection (refresh tokens die after 7 days while the Google Cloud consent screen is in Testing mode).",
    fix: "Reconnect Google Calendar in the consultation settings, then ask the candidate to open their booking link again — it stays valid until its expiry date.",
  },
  MEET_LINK_MISSING: {
    what: "The calendar event was created, but Google returned no Meet link, so the booking was not confirmed. An orphan event may now sit on the calendar.",
    fix: "Check that Meet is enabled for the connected calendar, remove the orphan event if one exists, then ask the candidate to retry their booking link.",
  },
};

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
    return `${fmt.format(d)} (${timeZone})`;
  } catch {
    return `${iso} (${timeZone})`;
  }
}

export function TalentBookingFailureNotificationEmailTemplate({
  candidateName,
  candidateEmail,
  slotIso,
  candidateTimezone,
  stage,
  detail,
  settingsUrl,
  adminUrl,
}: TalentBookingFailureNotificationEmailProps) {
  const copy = STAGE_COPY[stage];
  const when = formatSlot(slotIso, candidateTimezone);
  const trimmedDetail = detail?.trim() || null;

  return (
    <BaseLayout
      previewText={`Interview booking failed for ${candidateName} — action needed.`}
      hero={
        <HeroBand>
          <Heading>Interview booking failed</Heading>
          <Paragraph>
            A candidate tried to book their interview slot and hit an error. The application is
            still waiting on them — nothing was confirmed.
          </Paragraph>
        </HeroBand>
      }
    >
      <Callout tone="warn">
        <strong>Candidate:</strong> {candidateName} &middot; {candidateEmail}
        <br />
        <strong>Tried to book:</strong> {when}
      </Callout>

      <Paragraph>{copy.what}</Paragraph>

      {trimmedDetail && (
        <Paragraph>
          <em>{trimmedDetail}</em>
        </Paragraph>
      )}

      <Paragraph>{copy.fix}</Paragraph>

      <Button href={settingsUrl}>Open consultation settings</Button>

      <Paragraph>
        The application itself is in the <a href={adminUrl}>talent queue</a>, still at
        &ldquo;awaiting candidate&rdquo;. If the booking link expires before the candidate can
        retry, re-offer slots from there.
      </Paragraph>

      <Signoff
        preamble="Replying to this email goes nowhere — use the admin panel to act."
        from="Brandbite ops"
      />
    </BaseLayout>
  );
}

export async function renderTalentBookingFailureNotificationEmail(
  props: TalentBookingFailureNotificationEmailProps,
): Promise<{ subject: string; html: string }> {
  const html = await render(<TalentBookingFailureNotificationEmailTemplate {...props} />);
  return {
    subject: `Interview booking FAILED for ${props.candidateName} — action needed`,
    html,
  };
}

/** Default export for `react-email dev` preview only. */
export default function TalentBookingFailureNotificationEmailPreview() {
  return (
    <TalentBookingFailureNotificationEmailTemplate
      candidateName="Jane Designer"
      candidateEmail="jane@example.com"
      slotIso="2026-05-20T14:00:00.000Z"
      candidateTimezone="Europe/Istanbul"
      stage="CALENDAR_CREATE_FAILED"
      detail="Google token refresh failed (400): invalid_grant"
      settingsUrl="https://brandbite.studio/admin/consultations/settings"
      adminUrl="https://brandbite.studio/admin/talent-applications#example"
    />
  );
}
