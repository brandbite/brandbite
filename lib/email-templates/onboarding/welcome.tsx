// -----------------------------------------------------------------------------
// @file: lib/email-templates/onboarding/welcome.tsx
// @purpose: First "hello" email after a customer subscribes. It should feel
//           like a moment, not a generic transactional ping: a short
//           "what you get" box, three steps to the first delivery and a
//           personal sign-off.
//
//           Every promise here must match the public FAQ (2026-11-10):
//           tokens with an up-front cost per service, most requests in
//           24 to 48 hours, unlimited revisions, full ownership, source
//           files into Google Drive or Dropbox. No asset library, no
//           direct chat, no "starts within hours".
//
//           Sets brand voice for the rest of the customer email
//           lifecycle: warm but never cheesy, celebratory without
//           confetti-spam, specific about value delivered.
// -----------------------------------------------------------------------------

import * as React from "react";
import { render } from "@react-email/render";

import {
  BaseLayout,
  Button,
  Callout,
  FeatureItem,
  FeatureList,
  Heading,
  HeroBand,
  LinkText,
  Paragraph,
  Signoff,
  StepsList,
} from "../layout";

export type WelcomeEmailProps = {
  /** Recipient display name; greeting degrades gracefully if missing. */
  name?: string | null;
  /** Plan they just signed up to ("Starter" | "Brand" | "Full"); used in
   *  the hero subhead so the moment feels personalised. */
  planName?: string | null;
  /** Where the primary CTA points, usually `/customer/tickets/new`. */
  ctaUrl: string;
  /** Unused: there's no public showcase page yet. Kept so callers don't break. */
  showcaseUrl?: string;
  /** Documentation index for the help link in the footer area. */
  docsUrl: string;
};

/**
 * Brand voice notes — see docs/brand-voice.md for the full set.
 * Quick reference:
 *
 *   - "Hi" or "Hey" (not "Dear" / "Greetings")
 *   - Short sentences, active voice, no corporate throat-clearing
 *   - No em-dashes (`—`) or en-dashes (`–`) anywhere in user-facing
 *     copy. Break into two sentences instead.
 *   - Sparse celebratory emoji (🎉 in welcome, 🎨 for delivery). Never
 *     as decoration, only when the meaning earns it.
 *   - End with a real-feeling sign-off ("Alper, Brandbite") when it's a
 *     customer-trust moment; "The Brandbite team" for routine notes.
 *   - Avoid "unlock", "empower", "journey", "leverage", "game-changer",
 *     "we're so excited", "get ready to..."
 */
export function WelcomeEmailTemplate({ name, planName, ctaUrl, docsUrl }: WelcomeEmailProps) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  const planLine = planName
    ? `You're on the ${planName} plan and your design team is ready when you are.`
    : "Your design team is ready when you are.";

  return (
    <BaseLayout
      role={"customer"}
      reason={"You received this email because you created a brandbite account."}
      previewText="You're in. Here's how to send your first request."
      hero={
        <HeroBand>
          <Heading>Welcome aboard 🎉</Heading>
          <Paragraph>
            <strong>{greeting}</strong> {planLine}
          </Paragraph>
        </HeroBand>
      }
    >
      <Paragraph>
        We&apos;re really glad you went with us. brandbite isn&apos;t a marketplace. Vetted
        creatives take on your requests, and everything lives in one workspace your team shares.
      </Paragraph>

      <FeatureList title="What you get:">
        <FeatureItem>
          <strong>Tokens, not surprises.</strong> Every service shows its token cost before you send
          a request
        </FeatureItem>
        <FeatureItem>
          <strong>Most requests done in 24 to 48 hours.</strong> Bigger projects take 3 to 5
          business days
        </FeatureItem>
        <FeatureItem>
          <strong>Unlimited revisions</strong> until it&apos;s right
        </FeatureItem>
        <FeatureItem>
          <strong>Your files, for good.</strong> Full ownership, and source files can go straight
          into your Google Drive or Dropbox
        </FeatureItem>
      </FeatureList>

      <Heading as="h2">Three steps to your first delivery</Heading>

      <StepsList
        steps={[
          {
            title: "Send your first request",
            body: "Pick a service, check its token cost, and add your brief with any references or brand files.",
          },
          {
            title: "Follow it and give feedback",
            body: "Watch it move on your board. When work is ready for review, leave notes right on it or ask for changes.",
          },
          {
            title: "Download your files",
            body: "Approve it when it's right. The files are yours to keep, even if you cancel.",
          },
        ]}
      />

      <Button href={ctaUrl}>Send your first request</Button>

      <Callout tone="info">
        <strong>Tip:</strong> Don&apos;t worry about over-explaining your brief. Specifics save
        rounds. Add links, screenshots, even a rough sketch.
      </Callout>

      <Signoff
        preamble={
          <>
            Questions? Write to us at{" "}
            <LinkText href="mailto:hello@brandbite.studio">hello@brandbite.studio</LinkText>, or
            skim our guides at <LinkText href={docsUrl}>brandbite.studio/guides</LinkText>.
          </>
        }
        from="Alper, brandbite"
      />
    </BaseLayout>
  );
}

/**
 * Renders the template to a `{ subject, html }` pair. Not yet wired to
 * a sender — will hook into the post-checkout flow once the Stripe
 * webhook handler grows a "subscription_created" branch (separate PR).
 */
export async function renderWelcomeEmail(props: WelcomeEmailProps): Promise<{
  subject: string;
  html: string;
}> {
  const html = await render(<WelcomeEmailTemplate {...props} />);
  return {
    subject: "Welcome to brandbite. Let's make something good.",
    html,
  };
}

/**
 * Default export with placeholder props so `react-email dev` renders
 * the template in the preview sidebar. Never called from production.
 */
export default function WelcomeEmailPreview() {
  return (
    <WelcomeEmailTemplate
      name="Alper"
      planName="Brand"
      ctaUrl="https://brandbite.studio/customer/tickets/new"
      showcaseUrl="https://brandbite.studio/showcase"
      docsUrl="https://brandbite.studio/guides"
    />
  );
}
