// -----------------------------------------------------------------------------
// @file: lib/email-templates/talent/onboarded.tsx
// @purpose: Branded "welcome to the team" email sent to a candidate the
//           moment the SITE_OWNER clicks "Onboard now". Restates the agreed
//           hiring terms (working hours, accepted categories, tasks/week cap)
//           so the candidate has a written record of what was negotiated, and
//           previews what the dashboard offers.
//
//           IMPORTANT — this email does NOT carry the magic-link sign-in
//           URL. The magic-link goes out separately as the standard
//           "Sign in to Brandbite" email driven by BetterAuth's
//           sendMagicLink callback (lib/better-auth.ts). Two emails by
//           design:
//
//             1. The MAGIC-LINK email is utility — boring on purpose, mirrors
//                what every existing user sees, lets the candidate sign in.
//             2. THIS email is the brand moment — explains what they signed
//                up for, what they'll see at /creative/board, and that the
//                separate sign-in email is how they get in.
//
//           Splitting it this way keeps the magic-link template stable for
//           every other auth flow (regular sign-in, customer onboarding)
//           while letting this template be tone-tailored to "you just got
//           hired" without contaminating the generic case.
// -----------------------------------------------------------------------------

import * as React from "react";
import { render } from "@react-email/render";

import {
  BaseLayout,
  Callout,
  FeatureItem,
  FeatureList,
  Heading,
  HeroBand,
  Paragraph,
  Signoff,
} from "../layout";

export type TalentOnboardedEmailProps = {
  /** Recipient display name; greeting degrades gracefully if missing. */
  candidateName?: string | null;
  /** Free-text working hours captured at hire (e.g. "9-18 weekdays
   *  Europe/Istanbul"). Rendered verbatim. */
  workingHours: string;
  /** Resolved human names of the categories the admin approved. The
   *  caller (lib/talent-onboarding.ts) does the JobTypeCategory.id →
   *  name lookup before passing this in — the template is dumb on
   *  purpose so it can be previewed in `react-email dev`. */
  approvedCategoryNames: string[];
  /** Capacity cap (tasks/week) — number, may be null when no cap was
   *  agreed. */
  tasksPerWeekCap: number | null;
};

export function TalentOnboardedEmailTemplate({
  candidateName,
  workingHours,
  approvedCategoryNames,
  tasksPerWeekCap,
}: TalentOnboardedEmailProps) {
  const greeting = candidateName ? `Hi ${candidateName},` : "Hi,";

  return (
    <BaseLayout
      previewText="Welcome to Brandbite. Your sign-in link is on its way separately."
      hero={
        <HeroBand>
          <Heading>Welcome to the team 🎉</Heading>
          <Paragraph>
            <strong>{greeting}</strong> You&apos;re officially a Brandbite creative.
          </Paragraph>
        </HeroBand>
      }
    >
      <Paragraph>
        Excited to have you on board. Here&apos;s a written record of what we agreed during the
        interview, so we&apos;re both working off the same understanding from day one.
      </Paragraph>

      <FeatureList title="What we agreed">
        <FeatureItem>
          <strong>Working hours:</strong> {workingHours}
        </FeatureItem>
        {tasksPerWeekCap != null && (
          <FeatureItem>
            <strong>Capacity:</strong> up to {tasksPerWeekCap} tasks per week
          </FeatureItem>
        )}
        {approvedCategoryNames.length > 0 && (
          <FeatureItem>
            <strong>Categories you&apos;ll work in:</strong> {approvedCategoryNames.join(", ")}
          </FeatureItem>
        )}
      </FeatureList>

      <Paragraph>
        Tickets matching your categories will start landing in your dashboard as customer requests
        come in. You can pause new assignments at any point from your settings (vacation, busy week,
        end-of-quarter crunch — it&apos;s built in).
      </Paragraph>

      <Callout tone="info">
        Watch for a separate <strong>&ldquo;Sign in to Brandbite&rdquo;</strong> email landing in
        your inbox in the next minute or two — that&apos;s your magic-link to get into the
        dashboard. One click and you&apos;re in.
      </Callout>

      <Paragraph>
        If anything is unclear or feels off about the terms above, reply to this email — it lands in
        a real inbox. We&apos;d rather correct it now than discover the misunderstanding three weeks
        in.
      </Paragraph>

      <Signoff preamble="Looking forward to seeing what you build." from="Alper, Brandbite" />
    </BaseLayout>
  );
}

export async function renderTalentOnboardedEmail(
  props: TalentOnboardedEmailProps,
): Promise<{ subject: string; html: string }> {
  const html = await render(<TalentOnboardedEmailTemplate {...props} />);
  return {
    subject: "Welcome to Brandbite — you're in",
    html,
  };
}

/** Default export for `react-email dev` preview only. */
export default function TalentOnboardedEmailPreview() {
  return (
    <TalentOnboardedEmailTemplate
      candidateName="Jane"
      workingHours="9-18 weekdays Europe/Istanbul"
      approvedCategoryNames={[
        "Brand Strategy & Creative Direction",
        "Visual Design & Brand Identity",
      ]}
      tasksPerWeekCap={4}
    />
  );
}
