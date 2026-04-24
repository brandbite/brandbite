// -----------------------------------------------------------------------------
// @file: lib/email-templates/layout.tsx
// @purpose: Shared base layout + atomic components every Brandbite
//           transactional email composes from. Ensures consistent brand
//           header / footer, typography, and spacing across the auth,
//           billing, ticket, consultation, and admin email families.
//
//           Intentionally NOT exporting each atom as an in-app React
//           component — these render to HTML via @react-email/render and
//           should never be imported outside the email-templates/ folder.
// -----------------------------------------------------------------------------

import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading as REHeading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import {
  BRAND_ADDRESS,
  BRAND_NAME,
  BRAND_SUPPORT_EMAIL,
  BRAND_TAGLINE,
  BRAND_WEBSITE,
  MAX_WIDTH,
  PAGE_PADDING,
  brand,
  fonts,
} from "./tokens";

/* ---------------------------------------------------------------------------
 * BaseLayout
 *
 * Every template wraps its body in this. Provides:
 *   - <Html lang="en"> + <Head>
 *   - Inbox preview snippet (the grey line next to the subject in most clients)
 *   - Brand header bar (logo wordmark for now — real logo swap is a follow-up
 *     once we have a small PNG hosted and the R2 origin is in the img-src CSP
 *     of the public site; until then most clients block remote images from
 *     never-seen senders anyway, so text wordmark is safer)
 *   - Body container at MAX_WIDTH with consistent padding
 *   - Brand footer with tagline, support mailto, and (once configured) postal
 *     address for CAN-SPAM / EU compliance
 * ------------------------------------------------------------------------- */

type BaseLayoutProps = {
  /** Shows next to the subject line in most inbox list views. First
   *  marketing-side impression the recipient gets — keep it under 90 chars. */
  previewText: string;
  children: React.ReactNode;
};

export function BaseLayout({ previewText, children }: BaseLayoutProps) {
  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={brandWordmark}>
              <span style={{ color: brand.primary }}>b</span>
              <span>randbite</span>
            </Text>
          </Section>

          <Section style={contentSection}>{children}</Section>

          <Hr style={hr} />

          <Section style={footer}>
            <Text style={footerTagline}>{BRAND_TAGLINE}</Text>
            <Text style={footerText}>
              Questions? Write to us at{" "}
              <Link href={`mailto:${BRAND_SUPPORT_EMAIL}`} style={footerLink}>
                {BRAND_SUPPORT_EMAIL}
              </Link>
              .
            </Text>
            {BRAND_ADDRESS ? (
              <Text style={footerAddress}>
                {BRAND_NAME} &middot; {BRAND_ADDRESS}
              </Text>
            ) : null}
            <Text style={footerLegal}>
              <Link href={BRAND_WEBSITE} style={footerLink}>
                brandbite.studio
              </Link>
              {" · "}
              <Link href={`${BRAND_WEBSITE}/privacy`} style={footerLink}>
                Privacy
              </Link>
              {" · "}
              <Link href={`${BRAND_WEBSITE}/terms`} style={footerLink}>
                Terms
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/* ---------------------------------------------------------------------------
 * Atoms — tiny wrappers around @react-email/components with our tokens
 * pre-applied. Import these in templates instead of the raw primitives so
 * typography + spacing stay consistent.
 * ------------------------------------------------------------------------- */

type HeadingProps = {
  children: React.ReactNode;
  as?: "h1" | "h2" | "h3";
};

export function Heading({ children, as = "h1" }: HeadingProps) {
  const sizeStyles = {
    h1: { fontSize: "26px", lineHeight: "34px", marginTop: 0, marginBottom: "16px" },
    h2: { fontSize: "20px", lineHeight: "28px", marginTop: "24px", marginBottom: "12px" },
    h3: { fontSize: "16px", lineHeight: "24px", marginTop: "20px", marginBottom: "8px" },
  } as const;

  return (
    <REHeading
      as={as}
      style={{
        ...heading,
        ...sizeStyles[as],
      }}
    >
      {children}
    </REHeading>
  );
}

export function Paragraph({ children }: { children: React.ReactNode }) {
  return <Text style={paragraph}>{children}</Text>;
}

export function SmallText({ children }: { children: React.ReactNode }) {
  return <Text style={smallText}>{children}</Text>;
}

type ButtonProps = {
  href: string;
  children: React.ReactNode;
};

export function Button({ href, children }: ButtonProps) {
  // Rendered as an anchor styled like a button. <a>-based is the
  // email-compatible pattern — <button> tags are widely stripped.
  return (
    <Section style={buttonSection}>
      <Link href={href} style={buttonStyle}>
        {children}
      </Link>
    </Section>
  );
}

type CalloutProps = {
  children: React.ReactNode;
  /** Tone — "info" (orange-warm, default) or "warn" (red-tinted) */
  tone?: "info" | "warn";
};

export function Callout({ children, tone = "info" }: CalloutProps) {
  const backgroundColor = tone === "warn" ? "#fdeded" : brand.calloutBg;
  const color = tone === "warn" ? "#8b0000" : brand.calloutText;
  const borderColor = tone === "warn" ? "#f5c2c2" : "#f0c98b";

  return (
    <Section
      style={{
        backgroundColor,
        border: `1px solid ${borderColor}`,
        borderRadius: "10px",
        padding: "14px 18px",
        margin: "16px 0",
      }}
    >
      <Text style={{ ...paragraph, color, margin: 0 }}>{children}</Text>
    </Section>
  );
}

/* ---------------------------------------------------------------------------
 * Styles — inline styles are what email clients actually respect. React
 * Email's render step also walks the tree and inlines these at send time,
 * but keeping them in plain objects here is the idiomatic pattern and
 * makes the tokens.ts swap-out easy.
 * ------------------------------------------------------------------------- */

const body: React.CSSProperties = {
  backgroundColor: brand.bg,
  fontFamily: fonts.body,
  margin: 0,
  padding: 0,
  color: brand.text,
};

const container: React.CSSProperties = {
  maxWidth: `${MAX_WIDTH}px`,
  margin: "0 auto",
  backgroundColor: brand.card,
  borderRadius: "12px",
  overflow: "hidden",
  border: `1px solid ${brand.border}`,
};

const header: React.CSSProperties = {
  backgroundColor: brand.primary,
  padding: "20px 24px",
};

const brandWordmark: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: 700,
  fontSize: "24px",
  lineHeight: "30px",
  color: "#ffffff",
  letterSpacing: "-0.01em",
  margin: 0,
};

const contentSection: React.CSSProperties = {
  padding: PAGE_PADDING,
};

const heading: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: 700,
  color: brand.text,
  letterSpacing: "-0.01em",
};

const paragraph: React.CSSProperties = {
  fontFamily: fonts.body,
  fontSize: "15px",
  lineHeight: "24px",
  color: brand.text,
  margin: "0 0 16px",
};

const smallText: React.CSSProperties = {
  fontFamily: fonts.body,
  fontSize: "13px",
  lineHeight: "20px",
  color: brand.textMuted,
  margin: "12px 0 0",
};

const buttonSection: React.CSSProperties = {
  textAlign: "center" as const,
  margin: "24px 0",
};

const buttonStyle: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: brand.primary,
  color: "#ffffff",
  fontFamily: fonts.heading,
  fontWeight: 700,
  fontSize: "15px",
  lineHeight: "20px",
  textDecoration: "none",
  padding: "14px 32px",
  borderRadius: "10px",
};

const hr: React.CSSProperties = {
  borderColor: brand.border,
  margin: 0,
};

const footer: React.CSSProperties = {
  padding: "24px",
  textAlign: "center" as const,
};

const footerTagline: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: 600,
  fontSize: "14px",
  lineHeight: "20px",
  color: brand.textMuted,
  margin: "0 0 8px",
};

const footerText: React.CSSProperties = {
  fontFamily: fonts.body,
  fontSize: "13px",
  lineHeight: "20px",
  color: brand.textMuted,
  margin: "0 0 8px",
};

const footerAddress: React.CSSProperties = {
  fontFamily: fonts.body,
  fontSize: "12px",
  lineHeight: "18px",
  color: brand.textMuted,
  margin: "0 0 8px",
};

const footerLegal: React.CSSProperties = {
  fontFamily: fonts.body,
  fontSize: "12px",
  lineHeight: "18px",
  color: brand.textMuted,
  margin: 0,
};

const footerLink: React.CSSProperties = {
  color: brand.textMuted,
  textDecoration: "underline",
};
