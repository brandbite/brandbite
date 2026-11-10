// -----------------------------------------------------------------------------
// @file: lib/email-templates/layout.tsx
// @purpose: The building blocks the React Email templates (auth, onboarding,
//           talent, consultation, meeting) compose from. Since 2026-11 they
//           sit on the shared frame in ./frame.tsx, so every brandbite email
//           has the same header, role badge, typography, button and footer.
//
//           These render to HTML via @react-email/render and should never be
//           imported outside the email-templates/ folder.
// -----------------------------------------------------------------------------

import * as React from "react";
import { Link, Section, Text } from "@react-email/components";

import { EmailFrame, Notice, Title, frame, type EmailRole } from "./frame";
import { fonts } from "./tokens";

type BaseLayoutProps = {
  /** Shows next to the subject line in most inbox list views. Under ~90 chars. */
  previewText: string;
  /** The recipient's workspace badge. Leave out for people without one yet
   *  (applicants, someone confirming their email). */
  role?: EmailRole | null;
  /** "You received this email because …" — the footer's first line. */
  reason?: string;
  /** Link to the recipient's notification settings, when they have any. */
  preferencesUrl?: string | null;
  /** Kept for older templates: rendered as plain content now. */
  hero?: React.ReactNode;
  children: React.ReactNode;
};

export function BaseLayout({
  previewText,
  role = null,
  reason = "You received this email because of your brandbite account.",
  preferencesUrl = null,
  hero,
  children,
}: BaseLayoutProps) {
  return (
    <EmailFrame
      role={role}
      previewText={previewText}
      reason={reason}
      preferencesUrl={preferencesUrl}
    >
      {hero}
      {children}
    </EmailFrame>
  );
}

/* ---------------------------------------------------------------------------
 * Atoms
 * ------------------------------------------------------------------------- */

type HeadingProps = {
  children: React.ReactNode;
  as?: "h1" | "h2" | "h3";
};

export function Heading({ children, as = "h1" }: HeadingProps) {
  if (as === "h1") return <Title>{children}</Title>;
  const size =
    as === "h2"
      ? { fontSize: "20px", lineHeight: "28px" }
      : { fontSize: "17px", lineHeight: "24px" };
  const Tag = as;
  return (
    <Tag
      style={{
        margin: "24px 0 10px",
        fontWeight: 700,
        color: frame.ink,
        fontFamily: fonts.heading,
        ...size,
      }}
    >
      {children}
    </Tag>
  );
}

export function Paragraph({ children }: { children: React.ReactNode }) {
  return <Text style={paragraph}>{children}</Text>;
}

export function SmallText({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ margin: "0 0 12px", fontSize: "14px", lineHeight: "21px", color: frame.muted }}>
      {children}
    </Text>
  );
}

/** Older templates open with a "hero" block; in the new frame it's just the top of the content. */
export function HeroBand({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/** One check-marked line inside a FeatureList. */
export function FeatureItem({ children }: { children: React.ReactNode }) {
  return (
    <table
      role="presentation"
      cellPadding={0}
      cellSpacing={0}
      style={{ width: "100%", marginBottom: "8px" }}
    >
      <tbody>
        <tr>
          <td style={{ verticalAlign: "top", width: "22px", paddingRight: "10px" }}>
            <div
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "999px",
                backgroundColor: frame.success.bg,
                color: frame.success.text,
                fontSize: "12px",
                lineHeight: "20px",
                fontWeight: 700,
                textAlign: "center",
              }}
            >
              {"✓"}
            </div>
          </td>
          <td style={{ verticalAlign: "top" }}>
            <Text style={{ ...paragraph, margin: 0 }}>{children}</Text>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** A bordered box of FeatureItems ("what's included"). */
export function FeatureList({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <Section
      style={{
        margin: "8px 0 20px",
        padding: "16px 18px 8px",
        border: `1px solid ${frame.border}`,
        borderRadius: "14px",
        backgroundColor: "#FAF9F7",
      }}
    >
      {title ? (
        <Text
          style={{
            margin: "0 0 12px",
            fontSize: "16px",
            lineHeight: "22px",
            fontWeight: 700,
            color: frame.ink,
          }}
        >
          {title}
        </Text>
      ) : null}
      {children}
    </Section>
  );
}

export function Button({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Section style={{ margin: "8px 0 20px" }}>
      <table role="presentation" cellPadding={0} cellSpacing={0}>
        <tbody>
          <tr>
            <td style={{ borderRadius: "8px", backgroundColor: frame.action }}>
              <Link
                href={href}
                className="bb-btn"
                style={{
                  display: "inline-block",
                  padding: "13px 28px",
                  fontSize: "17px",
                  lineHeight: "22px",
                  fontWeight: 700,
                  color: "#FFFFFF",
                  textDecoration: "none",
                  borderRadius: "8px",
                }}
              >
                {children}
              </Link>
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}

export function LinkText({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ color: frame.action, textDecoration: "underline" }}>
      {children}
    </Link>
  );
}

type Step = { title: string; body: string };

/** Numbered steps ("here's how it works"). Tables, because Outlook. */
export function StepsList({ steps }: { steps: Step[] }) {
  return (
    <Section style={{ margin: "16px 0 20px" }}>
      {steps.map((step, index) => (
        <table
          key={step.title}
          role="presentation"
          cellPadding={0}
          cellSpacing={0}
          style={{ width: "100%", marginBottom: "14px" }}
        >
          <tbody>
            <tr>
              <td style={{ verticalAlign: "top", width: "32px", paddingRight: "12px" }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "999px",
                    backgroundColor: "#FFE9DF",
                    color: "#8F310D",
                    fontSize: "14px",
                    lineHeight: "28px",
                    fontWeight: 700,
                    textAlign: "center",
                  }}
                >
                  {index + 1}
                </div>
              </td>
              <td style={{ verticalAlign: "top" }}>
                <Text
                  style={{
                    margin: "2px 0 2px",
                    fontSize: "16px",
                    lineHeight: "22px",
                    fontWeight: 700,
                    color: frame.ink,
                  }}
                >
                  {step.title}
                </Text>
                <Text
                  style={{ margin: 0, fontSize: "15px", lineHeight: "22px", color: frame.muted }}
                >
                  {step.body}
                </Text>
              </td>
            </tr>
          </tbody>
        </table>
      ))}
    </Section>
  );
}

type SignoffProps = { preamble?: React.ReactNode; from?: string };

export function Signoff({ preamble, from = "The brandbite team" }: SignoffProps) {
  return (
    <Section style={{ marginTop: "24px" }}>
      {preamble ? <Text style={paragraph}>{preamble}</Text> : null}
      <Text style={{ ...paragraph, margin: 0, color: frame.muted }}>{from}</Text>
    </Section>
  );
}

type CalloutProps = {
  children: React.ReactNode;
  /** "info" = blue note, "warn" = amber warning. */
  tone?: "info" | "warn";
  title?: string;
};

export function Callout({ children, tone = "info", title }: CalloutProps) {
  return (
    <Notice tone={tone === "warn" ? "warning" : "info"} title={title} plain>
      {children}
    </Notice>
  );
}

const paragraph: React.CSSProperties = {
  margin: "0 0 16px",
  fontSize: "16px",
  lineHeight: "24px",
  color: frame.text,
};
