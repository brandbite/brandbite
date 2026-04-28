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
  Img,
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
 *   - White-on-white branded header with the Brandbite PNG logo. PNG (not
 *     SVG) because Gmail / Outlook / Yahoo all reject SVG images. The PNG
 *     is generated from public/brandbite-logo.svg by
 *     scripts/build-email-logo.mjs at 2× retina (280px source → 140px
 *     display), kept under 5 KB.
 *   - Body container at MAX_WIDTH with consistent padding
 *   - Brand footer with tagline, support mailto, and (once configured) postal
 *     address for CAN-SPAM / EU compliance
 * ------------------------------------------------------------------------- */

/** Display width — half the source PNG width for retina sharpness on
 *  high-DPI screens. */
const LOGO_DISPLAY_WIDTH = 140;

/**
 * Resolve the logo URL once at module load.
 *
 * Production-shaped envs (NEXT_PUBLIC_APP_URL set, Vercel preview / prod)
 * use the absolute URL so email clients fetch the logo from our CDN —
 * which gives Apple/Gmail/Outlook/etc. a single cacheable asset.
 *
 * For react-email's local preview server (no NEXT_PUBLIC_APP_URL), we
 * inline the PNG as a base64 data URL so the preview UI actually
 * renders the image. data: URLs are well-supported in modern browsers
 * (which is what react-email's preview is) but unreliable in some
 * email clients — fine here because preview is not a real send.
 */
function resolveLogoUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv && /^https?:\/\//.test(fromEnv)) {
    return `${fromEnv.replace(/\/$/, "")}/brandbite-logo-email.png`;
  }
  // Dev-only fallback: read the PNG from public/ and embed it.
  try {
    // Lazy require to keep this off the production code path.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("node:path") as typeof import("node:path");
    const file = path.join(process.cwd(), "public", "brandbite-logo-email.png");
    if (fs.existsSync(file)) {
      const buf = fs.readFileSync(file);
      return `data:image/png;base64,${buf.toString("base64")}`;
    }
  } catch {
    // Ignore — fall through to last-resort URL
  }
  return `${BRAND_WEBSITE}/brandbite-logo-email.png`;
}

const LOGO_URL = resolveLogoUrl();

type BaseLayoutProps = {
  /** Shows next to the subject line in most inbox list views. First
   *  marketing-side impression the recipient gets — keep it under 90 chars. */
  previewText: string;
  /**
   * Optional flush-edge hero band rendered immediately below the logo
   * header, before the standard content padding kicks in. Use for
   * celebratory moments (welcome / milestone emails) — pass a
   * `<HeroBand>` here.
   */
  hero?: React.ReactNode;
  children: React.ReactNode;
};

export function BaseLayout({ previewText, hero, children }: BaseLayoutProps) {
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
            <Img
              src={LOGO_URL}
              alt={BRAND_NAME}
              width={LOGO_DISPLAY_WIDTH}
              // The PNG is 280px wide → halve in CSS for crisp rendering
              // on retina displays. height auto preserves the 4:1 aspect.
              style={{ display: "block", height: "auto" }}
            />
          </Section>

          {hero}

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

/**
 * Celebratory full-width hero band — pale orange-tinted background,
 * heavier padding, used at the top of welcome / milestone emails to
 * mark the moment as special. Sits flush below the white logo header
 * so the orange of the band picks up the brand color the logo
 * references.
 */
export function HeroBand({ children }: { children: React.ReactNode }) {
  return <Section style={heroBand}>{children}</Section>;
}

type FeatureItemProps = {
  /** Short description; one phrase per line is best. */
  children: React.ReactNode;
};

/**
 * Single check-marked benefit line. Compose inside `<FeatureList>` to
 * render a "what you unlocked" / "what's included" block — the kind of
 * thing that makes a paid customer feel like the money was well spent.
 */
export function FeatureItem({ children }: FeatureItemProps) {
  return (
    <table
      role="presentation"
      cellPadding={0}
      cellSpacing={0}
      style={{ width: "100%", marginBottom: "8px" }}
    >
      <tbody>
        <tr>
          <td
            style={{
              verticalAlign: "top",
              width: "24px",
              paddingRight: "10px",
            }}
          >
            <div style={featureCheck}>{"✓"}</div>
          </td>
          <td style={{ verticalAlign: "top" }}>
            <Text style={{ ...paragraph, margin: 0 }}>{children}</Text>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/**
 * Orange-tinted callout box wrapping a stack of `<FeatureItem>`s.
 * Visually frames the benefits the customer just unlocked so it
 * doesn't feel like a generic onboarding email.
 */
export function FeatureList({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <Section style={featureBox}>
      {title ? (
        <Text style={{ ...stepTitle, fontSize: "14px", margin: "0 0 12px" }}>{title}</Text>
      ) : null}
      {children}
    </Section>
  );
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

export function LinkText({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ color: brand.primary, textDecoration: "underline" }}>
      {children}
    </Link>
  );
}

type Step = {
  title: string;
  body: string;
};

/**
 * Numbered step list with warm bullet circles. Used on the welcome
 * email's "here's how it works" section and anywhere a short 3-step
 * flow is worth calling out. Rendered as an HTML table because flexbox
 * isn't reliable in Outlook — the table layout survives every mail
 * client we've tested.
 */
export function StepsList({ steps }: { steps: Step[] }) {
  return (
    <Section style={{ margin: "24px 0" }}>
      {steps.map((step, index) => (
        <table
          key={step.title}
          role="presentation"
          cellPadding={0}
          cellSpacing={0}
          style={{
            width: "100%",
            marginBottom: index === steps.length - 1 ? 0 : "18px",
          }}
        >
          <tbody>
            <tr>
              <td
                style={{
                  verticalAlign: "top",
                  width: "36px",
                  paddingRight: "14px",
                }}
              >
                <div style={stepBadge}>{index + 1}</div>
              </td>
              <td style={{ verticalAlign: "top" }}>
                <Text style={{ ...stepTitle, margin: "4px 0 4px" }}>{step.title}</Text>
                <Text style={{ ...stepBody, margin: 0 }}>{step.body}</Text>
              </td>
            </tr>
          </tbody>
        </table>
      ))}
    </Section>
  );
}

type SignoffProps = {
  /** Usually "The Brandbite team" — swap if we want named signatures later. */
  from?: string;
  /** Optional preceding line, e.g. "Any questions? Just reply to this email." */
  preamble?: React.ReactNode;
};

/**
 * Warm human sign-off, used at the end of emails where a friendly close
 * is on-brand (welcome, onboarding, consultation reminders, etc.). Keep
 * out of purely-transactional emails like password reset — those stay
 * tight.
 */
export function Signoff({ preamble, from = "The Brandbite team" }: SignoffProps) {
  return (
    <Section style={{ marginTop: "28px" }}>
      {preamble ? <Text style={paragraph}>{preamble}</Text> : null}
      <Text style={{ ...paragraph, margin: 0, color: brand.textMuted }}>{from}</Text>
    </Section>
  );
}

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
  // White header (matches the website's glass nav). The logo PNG is
  // already two-tone — orange "b" + dark "randbite" — so the orange
  // brand color shows up via the logo, and we save the strong color
  // for the CTA button below where it actually matters.
  backgroundColor: brand.card,
  padding: "24px 24px 20px",
  borderBottom: `1px solid ${brand.border}`,
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

const stepBadge: React.CSSProperties = {
  width: "32px",
  height: "32px",
  lineHeight: "32px",
  textAlign: "center" as const,
  borderRadius: "16px",
  backgroundColor: brand.primary,
  color: "#ffffff",
  fontFamily: fonts.heading,
  fontWeight: 700,
  fontSize: "14px",
};

const stepTitle: React.CSSProperties = {
  fontFamily: fonts.heading,
  fontWeight: 700,
  fontSize: "15px",
  lineHeight: "22px",
  color: brand.text,
};

const stepBody: React.CSSProperties = {
  fontFamily: fonts.body,
  fontSize: "14px",
  lineHeight: "22px",
  color: brand.textMuted,
};

const heroBand: React.CSSProperties = {
  backgroundColor: brand.calloutBg,
  // Soft inset edge — feels less like a hard transition from the
  // white logo header above it.
  padding: "32px 28px",
  borderBottom: `1px solid ${brand.border}`,
};

const featureBox: React.CSSProperties = {
  backgroundColor: brand.calloutBg,
  border: `1px solid ${brand.border}`,
  borderRadius: "10px",
  padding: "20px",
  margin: "20px 0 24px",
};

const featureCheck: React.CSSProperties = {
  width: "20px",
  height: "20px",
  lineHeight: "20px",
  textAlign: "center" as const,
  borderRadius: "10px",
  backgroundColor: brand.primary,
  color: "#ffffff",
  fontSize: "12px",
  fontWeight: 700,
  fontFamily: fonts.body,
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
