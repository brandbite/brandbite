// -----------------------------------------------------------------------------
// @file: lib/email-templates/talent/decline.tsx
// @purpose: Polite rejection email sent to a talent applicant after the
//           SITE_OWNER declines their application. Optional admin-supplied
//           `reason` is rendered verbatim above the standard copy so the
//           rejection can be soft-tailored ("we're focused on motion this
//           quarter") without opening a separate inbox thread.
//
//           Brand voice: kind, specific, doesn't promise re-applications
//           that will never come. Avoids "unfortunately", "regret to
//           inform", and other ceremonial corporate filler. Mirrors the
//           welcome email's tone — short, human, signed by an actual
//           person.
// -----------------------------------------------------------------------------

import * as React from "react";
import { render } from "@react-email/render";

import { BaseLayout, Heading, HeroBand, LinkText, Paragraph, Signoff } from "../layout";

export type TalentDeclineEmailProps = {
  /** Recipient display name; greeting degrades gracefully if missing. */
  candidateName?: string | null;
  /** Optional free-text note from the SITE_OWNER. Rendered verbatim if
   *  provided; null/empty falls back to a generic paragraph. */
  reason?: string | null;
  /** Showcase URL for the "see what we've shipped" tertiary link. */
  showcaseUrl: string;
};

export function TalentDeclineEmailTemplate({
  candidateName,
  reason,
  showcaseUrl,
}: TalentDeclineEmailProps) {
  const greeting = candidateName ? `Hi ${candidateName},` : "Hi,";
  const trimmedReason = reason?.trim() || null;

  return (
    <BaseLayout
      previewText="An update on your Brandbite application."
      hero={
        <HeroBand>
          <Heading>An update on your application</Heading>
          <Paragraph>
            <strong>{greeting}</strong> Thanks for taking the time to apply to Brandbite.
          </Paragraph>
        </HeroBand>
      }
    >
      <Paragraph>
        We reviewed your work carefully. For now, we&apos;re not going to move forward with your
        application.
      </Paragraph>

      {trimmedReason ? (
        <Paragraph>
          <em>{trimmedReason}</em>
        </Paragraph>
      ) : (
        <Paragraph>
          This is rarely about quality. Our hiring needs are narrow at any given moment and we get
          many strong applications. A &ldquo;no&rdquo; from us today often just means the timing or
          the specific skill mix isn&apos;t right for what we have on the roster.
        </Paragraph>
      )}

      <Paragraph>
        If you&apos;d like to see what we ship,{" "}
        <LinkText href={showcaseUrl}>browse the showcase</LinkText> for real client work. And if
        your circumstances or our needs change, you&apos;re welcome to apply again later — we
        won&apos;t hold a previous decision against a new application.
      </Paragraph>

      <Signoff preamble="Wishing you the best with the next thing." from="Alper, Brandbite" />
    </BaseLayout>
  );
}

export async function renderTalentDeclineEmail(
  props: TalentDeclineEmailProps,
): Promise<{ subject: string; html: string }> {
  const html = await render(<TalentDeclineEmailTemplate {...props} />);
  return {
    subject: "An update on your Brandbite application",
    html,
  };
}

/** Default export so `react-email dev` renders the template in the
 *  preview sidebar. Never called from production. */
export default function TalentDeclineEmailPreview() {
  return (
    <TalentDeclineEmailTemplate
      candidateName="Jane"
      reason="We're focused on motion designers this quarter and your portfolio leans more print. Worth a look again next year."
      showcaseUrl="https://brandbite.studio/showcase"
    />
  );
}
