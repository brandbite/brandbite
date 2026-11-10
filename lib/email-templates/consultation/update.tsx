// -----------------------------------------------------------------------------
// @file: lib/email-templates/consultation/update.tsx
// @purpose: Tells the customer who requested a consultation that an admin
//           scheduled it, changed the time or link, or cancelled it (with the
//           token refund). Admin scheduling used to send nothing, so
//           customers never learned the time or the video link.
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
import { BRAND_SUPPORT_EMAIL } from "../tokens";

export type ConsultationUpdateKind = "scheduled" | "rescheduled" | "canceled";

export type ConsultationUpdateEmailProps = {
  kind: ConsultationUpdateKind;
  recipientName?: string | null;
  /** ISO instant; required for scheduled / rescheduled. */
  scheduledAt?: string | null;
  /** Customer's timezone from the request (IANA); falls back to UTC. */
  timeZone?: string | null;
  videoLink?: string | null;
  /** Tokens returned to the company on cancellation. */
  refundedTokens?: number | null;
  /** Where the customer sees their consultations. */
  consultationsUrl: string;
};

export function formatConsultationTime(iso: string, timeZone?: string | null): string {
  const tz = timeZone || "UTC";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: tz,
      timeZoneName: "short",
    }).format(new Date(iso));
  } catch {
    // Unknown timezone string — fall back to UTC rather than failing the send.
    return (
      new Intl.DateTimeFormat("en-GB", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(new Date(iso)) + " UTC"
    );
  }
}

export function ConsultationUpdateEmailTemplate(props: ConsultationUpdateEmailProps) {
  const { kind, recipientName, scheduledAt, timeZone, videoLink, refundedTokens } = props;
  const greeting = recipientName ? `Hi ${recipientName},` : "Hi,";
  const when = scheduledAt ? formatConsultationTime(scheduledAt, timeZone) : null;

  if (kind === "canceled") {
    return (
      <BaseLayout
        role={"customer"}
        reason={"You received this email because you booked a consultation with brandbite."}
        previewText="Your brandbite consultation was cancelled."
        hero={
          <HeroBand>
            <Heading>Your consultation was cancelled</Heading>
            <Paragraph>
              <strong>{greeting}</strong> We&apos;ve cancelled your consultation with the brandbite
              team.
            </Paragraph>
          </HeroBand>
        }
      >
        {refundedTokens ? (
          <Callout tone="info">
            {refundedTokens} tokens have been returned to your company&apos;s balance.
          </Callout>
        ) : null}
        <Paragraph>
          If you&apos;d still like to talk, you can book a new consultation from your dashboard.
        </Paragraph>
        <Button href={props.consultationsUrl}>Open consultations</Button>
        <Signoff />
      </BaseLayout>
    );
  }

  const title =
    kind === "rescheduled" ? "Your consultation has a new time" : "Your consultation is booked";

  return (
    <BaseLayout
      role={"customer"}
      reason={"You received this email because you booked a consultation with brandbite."}
      previewText={when ? `${title}: ${when}` : title}
      hero={
        <HeroBand>
          <Heading>{title}</Heading>
          <Paragraph>
            <strong>{greeting}</strong>{" "}
            {kind === "rescheduled"
              ? "We've updated the details of your consultation with the brandbite team."
              : "Your consultation with the brandbite team is confirmed."}
          </Paragraph>
        </HeroBand>
      }
    >
      {when ? (
        <Callout tone="info">
          <strong>{when}</strong>
        </Callout>
      ) : null}
      {videoLink ? (
        <>
          <Paragraph>Join the call with this link at the time above:</Paragraph>
          <Button href={videoLink}>Join the call</Button>
        </>
      ) : null}
      <Paragraph>
        You can also find the time and link under Consultation in your dashboard. If the time no
        longer works, write to us at{" "}
        <LinkText href={`mailto:${BRAND_SUPPORT_EMAIL}`}>{BRAND_SUPPORT_EMAIL}</LinkText>.
      </Paragraph>
      <Signoff />
    </BaseLayout>
  );
}

export async function renderConsultationUpdateEmail(
  props: ConsultationUpdateEmailProps,
): Promise<{ subject: string; html: string }> {
  const html = await render(<ConsultationUpdateEmailTemplate {...props} />);
  const subject =
    props.kind === "canceled"
      ? "Your brandbite consultation was cancelled"
      : props.kind === "rescheduled"
        ? "Your brandbite consultation has a new time"
        : "Your brandbite consultation is booked";
  return { subject, html };
}

/** Default export so `react-email dev` can preview it. Never called in prod. */
export default function ConsultationUpdateEmailPreview() {
  return (
    <ConsultationUpdateEmailTemplate
      kind="scheduled"
      recipientName="Jane"
      scheduledAt="2026-11-10T10:00:00.000Z"
      timeZone="Europe/Istanbul"
      videoLink="https://meet.google.com/abc-defg-hij"
      consultationsUrl="https://brandbite.studio/customer/consultation"
    />
  );
}
