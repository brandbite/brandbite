// -----------------------------------------------------------------------------
// @file: lib/email-templates/talent/decline-post-interview.tsx
// @purpose: Polite rejection email sent to a talent applicant AFTER the
//           interview happened. Sister template to decline.tsx — same
//           layout, materially different tone:
//
//             - Acknowledges the candidate's time investment (the
//               interview, the prep). The pre-interview decline doesn't
//               have to.
//             - References the conversation when the admin's optional
//               `reason` field is provided ("we talked about X and Y…").
//             - Explicitly invites them to stay in touch — a candidate
//               who got to the interview round is closer to a future
//               hire than a candidate who bounced at the form.
//
//           Triggered when the SITE_OWNER picks "Decline after interview"
//           from the admin detail panel (status moves
//           INTERVIEW_HELD → REJECTED_AFTER_INTERVIEW).
//
//           Brand voice: warm, specific, no corporate filler. Avoids
//           "unfortunately", "regret to inform", and any phrasing that
//           suggests we're sad TO write this email — that's about us,
//           not the candidate.
// -----------------------------------------------------------------------------

import * as React from "react";
import { render } from "@react-email/render";

import { BaseLayout, Heading, HeroBand, LinkText, Paragraph, Signoff } from "../layout";

export type TalentDeclinePostInterviewEmailProps = {
  /** Recipient display name; greeting degrades gracefully if missing. */
  candidateName?: string | null;
  /** Optional free-text note from the SITE_OWNER. Rendered verbatim if
   *  provided (italicized as a soft callout). Null/empty falls back to
   *  the generic post-interview copy. */
  reason?: string | null;
  /** Showcase URL for the "see what we're shipping" tertiary link.
   *  Same as decline.tsx — keeps the visual branch identical. */
  showcaseUrl: string;
};

export function TalentDeclinePostInterviewEmailTemplate({
  candidateName,
  reason,
  showcaseUrl,
}: TalentDeclinePostInterviewEmailProps) {
  const greeting = candidateName ? `Hi ${candidateName},` : "Hi,";
  const trimmedReason = reason?.trim() || null;

  return (
    <BaseLayout
      previewText="An update on your Brandbite application after the interview."
      hero={
        <HeroBand>
          <Heading>An update after our chat</Heading>
          <Paragraph>
            <strong>{greeting}</strong> Thanks for taking the time to talk with us.
          </Paragraph>
        </HeroBand>
      }
    >
      <Paragraph>
        We really enjoyed the conversation and appreciated you walking us through your work. After
        thinking it over, we&apos;re not going to move forward with the role right now.
      </Paragraph>

      {trimmedReason ? (
        <Paragraph>
          <em>{trimmedReason}</em>
        </Paragraph>
      ) : (
        <Paragraph>
          This isn&apos;t about the quality of the conversation or your work. Hiring decisions for
          us depend on a narrow mix of skill, capacity, and timing — everything has to line up. This
          time around, the match wasn&apos;t quite right for what we have on the roster.
        </Paragraph>
      )}

      <Paragraph>
        If your situation changes, or ours does, we&apos;d genuinely like to hear from you again —
        please reapply down the road, no need to be shy about it. In the meantime, you can see what
        we&apos;re shipping at <LinkText href={showcaseUrl}>the showcase</LinkText>.
      </Paragraph>

      <Signoff
        preamble="Thanks again for your time. The conversation will stay with us — best of luck with the next thing you build."
        from="Alper, Brandbite"
      />
    </BaseLayout>
  );
}

export async function renderTalentDeclinePostInterviewEmail(
  props: TalentDeclinePostInterviewEmailProps,
): Promise<{ subject: string; html: string }> {
  const html = await render(<TalentDeclinePostInterviewEmailTemplate {...props} />);
  return {
    subject: "An update after our chat at Brandbite",
    html,
  };
}

/** Default export for `react-email dev` preview only. */
export default function TalentDeclinePostInterviewEmailPreview() {
  return (
    <TalentDeclinePostInterviewEmailTemplate
      candidateName="Jane"
      reason="The motion-graphics work you showed was great — we just don't have steady volume in that lane this quarter. Worth a re-look in Q3 if you're still around."
      showcaseUrl="https://brandbite.studio/showcase"
    />
  );
}
