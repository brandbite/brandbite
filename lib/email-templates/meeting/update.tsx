// -----------------------------------------------------------------------------
// @file: lib/email-templates/meeting/update.tsx
// @purpose: Emails for public meeting bookings. The visitor gets the time and a
//           link to reschedule or cancel. The host also gets what the visitor
//           wrote, which is deliberately kept out of the calendar invite.
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
import { formatConsultationTime } from "../consultation/update";

export type MeetingEmailKind = "confirmed" | "rescheduled" | "canceled";

export type MeetingEmailProps = {
  kind: MeetingEmailKind;
  audience: "visitor" | "host";
  visitorName: string;
  visitorEmail: string;
  company?: string | null;
  note?: string | null;
  startsAt: string;
  /** Falls back to UTC. */
  timeZone?: string | null;
  videoLink?: string | null;
  manageUrl?: string | null;
};

const TITLES: Record<MeetingEmailKind, { visitor: string; host: string }> = {
  confirmed: { visitor: "Your call with brandbite is booked", host: "New meeting booked" },
  rescheduled: { visitor: "Your call with brandbite has a new time", host: "Meeting rescheduled" },
  canceled: { visitor: "Your call with brandbite was canceled", host: "Meeting canceled" },
};

export function MeetingEmailTemplate(props: MeetingEmailProps) {
  const title = TITLES[props.kind][props.audience];
  const when = formatConsultationTime(props.startsAt, props.timeZone);

  return (
    <BaseLayout
      role={props.audience === "host" ? "admin" : null}
      reason={
        props.audience === "host"
          ? "You received this email because you host brandbite calls."
          : "You received this email because you booked a call with brandbite."
      }
      previewText={`${title}: ${when}`}
      hero={
        <HeroBand>
          <Heading>{title}</Heading>
          {props.audience === "visitor" ? (
            <Paragraph>
              <strong>Hi {props.visitorName},</strong>{" "}
              {props.kind === "canceled"
                ? "This call is no longer on the calendar."
                : "You'll also get a calendar invite from Google."}
            </Paragraph>
          ) : (
            <Paragraph>
              <strong>{props.visitorName}</strong> ({props.visitorEmail})
              {props.company ? ` from ${props.company}` : ""}
            </Paragraph>
          )}
        </HeroBand>
      }
    >
      <Callout tone="info">
        <strong>{when}</strong>
      </Callout>
      {props.audience === "host" && props.note ? <Paragraph>{props.note}</Paragraph> : null}
      {props.kind !== "canceled" && props.videoLink ? (
        <Button href={props.videoLink}>Join the call</Button>
      ) : null}
      {props.audience === "visitor" && props.kind !== "canceled" && props.manageUrl ? (
        <Paragraph>
          Need to change something? <LinkText href={props.manageUrl}>Reschedule or cancel</LinkText>
          .
        </Paragraph>
      ) : null}
      <Signoff />
    </BaseLayout>
  );
}

export async function renderMeetingEmail(
  props: MeetingEmailProps,
): Promise<{ subject: string; html: string }> {
  return {
    subject:
      props.audience === "host"
        ? `[brandbite admin] ${TITLES[props.kind].host}`
        : TITLES[props.kind].visitor,
    html: await render(<MeetingEmailTemplate {...props} />),
  };
}
