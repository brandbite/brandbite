// -----------------------------------------------------------------------------
// @file: lib/email-templates/auth/verify-email.tsx
// @purpose: Email sent to a new sign-up asking them to confirm their email
//           before they can sign in. Triggered by BetterAuth's
//           `emailVerification.sendVerificationEmail` hook (lib/better-auth.ts).
//
//           This is the pilot template for the React Email-based
//           transactional email system. Other templates should follow the
//           same shape: default export is a function returning a full
//           <BaseLayout>-wrapped JSX tree; a paired `render*Email()`
//           function converts it to the { subject, html } pair that
//           lib/email.ts's sendNotificationEmail consumes.
// -----------------------------------------------------------------------------

import * as React from "react";
import { render } from "@react-email/render";

import { BaseLayout, Button, Heading, Paragraph, SmallText } from "../layout";

export type VerifyEmailProps = {
  /** Recipient display name; omitted politely if we don't have one yet. */
  name?: string | null;
  /** The verify-email link BetterAuth generated. Opaque, one-time. */
  url: string;
};

export function VerifyEmailTemplate({ name, url }: VerifyEmailProps) {
  const greeting = name ? `Welcome, ${name}` : "Welcome to Brandbite";

  return (
    <BaseLayout previewText="Confirm your email to finish setting up your Brandbite account.">
      <Heading>{greeting}</Heading>
      <Paragraph>
        Thanks for signing up. Confirm your email address to finish setting up your account. You
        won&apos;t be able to sign in until you do.
      </Paragraph>

      <Button href={url}>Verify email</Button>

      <SmallText>
        Or copy and paste this link into your browser:
        <br />
        <span style={{ wordBreak: "break-all", color: "#605c56" }}>{url}</span>
      </SmallText>

      <SmallText>
        This link expires in 24 hours. If you didn&apos;t create a Brandbite account, you can safely
        ignore this email.
      </SmallText>
    </BaseLayout>
  );
}

/**
 * Renders the template to the `{ subject, html }` pair that `lib/email.ts`
 * expects. Callers (BetterAuth's hook) just need to pass the recipient.
 */
export async function renderVerifyEmail(props: VerifyEmailProps): Promise<{
  subject: string;
  html: string;
}> {
  const html = await render(<VerifyEmailTemplate {...props} />);
  return {
    subject: "Verify your Brandbite email",
    html,
  };
}

/**
 * Default export with placeholder props so `react-email dev --dir
 * lib/email-templates` renders this template in the preview UI. Never
 * called from production code — BetterAuth calls `renderVerifyEmail`
 * with real args.
 */
export default function VerifyEmailPreview() {
  return (
    <VerifyEmailTemplate
      name="Alper"
      url="https://brandbite.studio/verify?token=preview-only-00000000"
    />
  );
}
