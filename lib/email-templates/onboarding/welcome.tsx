// -----------------------------------------------------------------------------
// @file: lib/email-templates/onboarding/welcome.tsx
// @purpose: First "hello" email after a customer subscribes. This is a
//           celebratory moment — they just paid us $495–$1,895/month — so
//           the email needs to feel like a moment, not a generic
//           transactional ping. Uses the polished hero band, framed
//           "what you unlocked" feature box, and a personal founder
//           sign-off.
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
  /** Where the primary CTA points — usually `/customer/board`. */
  ctaUrl: string;
  /** Showcase page URL for the "see example work" tertiary link. */
  showcaseUrl: string;
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
export function WelcomeEmailTemplate({
  name,
  planName,
  ctaUrl,
  showcaseUrl,
  docsUrl,
}: WelcomeEmailProps) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  const planLine = planName
    ? `You're on the ${planName} plan and your design team is ready when you are.`
    : "Your design team is ready when you are.";

  return (
    <BaseLayout
      previewText="You're in. Your first design request takes about a minute."
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
        We&apos;re really glad you went with us. Brandbite isn&apos;t a marketplace and it
        isn&apos;t a freelancer roulette. You get a small, vetted team that learns your brand and
        gets faster every project.
      </Paragraph>

      <FeatureList title="What you just got:">
        <FeatureItem>
          <strong>1 to 2 day turnaround</strong> on every request
        </FeatureItem>
        <FeatureItem>
          <strong>Unlimited revisions</strong> until it&apos;s exactly what you want
        </FeatureItem>
        <FeatureItem>
          <strong>Direct messaging</strong> with the designer working on your project
        </FeatureItem>
        <FeatureItem>
          <strong>Brand asset library.</strong> Every file, organised, always yours
        </FeatureItem>
      </FeatureList>

      <Heading as="h2">Three steps to your first delivery</Heading>

      <StepsList
        steps={[
          {
            title: "Submit your first request",
            body: "Logo, landing page, ad set, deck. Whatever's on your plate. Your designer starts within a few hours.",
          },
          {
            title: "Chat directly with your designer",
            body: "Share references, brand guidelines, the rough idea you have. The clearer the brief, the faster the turnaround.",
          },
          {
            title: "Get the file within 2 business days",
            body: "Revise as many times as you want. When it's perfect, the file is yours. Full ownership, no extra fees.",
          },
        ]}
      />

      <Button href={ctaUrl}>Submit your first design request</Button>

      <Callout tone="info">
        <strong>Pro tip:</strong> Don&apos;t worry about over-explaining your brief. Specifics save
        rounds. Drop links, screenshots, even a rough sketch. Your designer turns ambiguity into
        clarity.
      </Callout>

      <Paragraph>
        Want to see what we&apos;ve made for others first?{" "}
        <LinkText href={showcaseUrl}>Browse the showcase</LinkText>. A small sample of real client
        work. Every piece there is something we shipped end to end.
      </Paragraph>

      <Signoff
        preamble={
          <>
            Reply to this email anytime. It lands in a real inbox and I read every one. If
            you&apos;d rather skim first, the docs and FAQ are at{" "}
            <LinkText href={docsUrl}>brandbite.studio/documentation</LinkText>.
          </>
        }
        from="Alper, Brandbite"
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
    subject: "Welcome to Brandbite. Let's make something good.",
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
      ctaUrl="https://brandbite.studio/customer/board"
      showcaseUrl="https://brandbite.studio/showcase"
      docsUrl="https://brandbite.studio/documentation"
    />
  );
}
