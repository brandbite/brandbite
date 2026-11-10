// -----------------------------------------------------------------------------
// @file: lib/email-templates/frame.tsx
// @purpose: The 2026-11 email frame every brandbite email uses (design from
//           the user, 2026-11-10): orange top bar, logo, role badge, heading,
//           a main card tinted in the recipient's role colour, info/warning
//           callouts, one button plus an optional secondary link, and a grey
//           footer that says why the email was sent.
//
//           Email-client rules followed here: tables for layout (Outlook),
//           inline styles only (React Email inlines them), PNG icons (no SVG),
//           no CSS variables. Role colours come from lib/role-colors.ts.
// -----------------------------------------------------------------------------

import * as React from "react";
import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import { copyrightLine } from "../brand";
import { ROLE_COLORS, type RoleKey } from "../role-colors";
import {
  BRAND_ADDRESS,
  BRAND_LEGAL_NAME,
  BRAND_SUPPORT_EMAIL,
  BRAND_WEBSITE,
  fonts,
} from "./tokens";

export type EmailRole = RoleKey;

/* ---------------------------------------------------------------------------
 * Tokens for this frame
 * ------------------------------------------------------------------------- */

export const frame = {
  pageBg: "#F5F3EF",
  card: "#FFFFFF",
  border: "#E6E2DC",
  ink: "#1F1E1D",
  text: "#2B2A29",
  muted: "#5F5B55",
  /** Top bar: the brand orange. */
  accent: "#F15B2B",
  /** Buttons and links: a darker orange so white text passes AA (5.2:1). */
  action: "#C2410C",
  footerBg: "#F7F5F2",
  info: { bg: "#EAF2FE", border: "#C9DCF5", title: "#1E3A8A", text: "#2B2A29" },
  warning: { bg: "#FFF3DC", border: "#F1D59C", title: "#2B2A29", text: "#2B2A29" },
  success: { bg: "#E3F4E5", text: "#1D6B2C" },
} as const;

/** Tones the icon PNGs exist in (scripts/build-email-icons.mjs). */
export type IconTone = "ink" | "info" | "warning" | RoleKey;
export type IconName =
  | "ticket"
  | "file"
  | "file-text"
  | "coins"
  | "info"
  | "alert"
  | "calendar"
  | "user"
  | "lock"
  | "check"
  | "palette"
  | "message";

function assetBase(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || BRAND_WEBSITE).replace(/\/$/, "");
}

/** Absolute URL of an icon PNG (emails can't use relative URLs). */
export function iconUrl(name: IconName, tone: IconTone): string {
  return `${assetBase()}/email-icons/${name}-${tone}.png`;
}

const roleCardTint: Record<RoleKey, { header: string; border: string; soft: string }> = {
  admin: { header: ROLE_COLORS.admin.bg, border: "#F6CDBB", soft: "#FFF4EE" },
  creative: { header: ROLE_COLORS.creative.bg, border: "#D9D0F7", soft: "#F7F4FF" },
  customer: { header: ROLE_COLORS.customer.bg, border: "#C9E3D0", soft: "#F3FAF5" },
};

const neutralTint = { header: "#F4F2EE", border: frame.border, soft: "#FAF9F7" };

/* ---------------------------------------------------------------------------
 * Frame
 * ------------------------------------------------------------------------- */

type EmailFrameProps = {
  /** The recipient's workspace badge; null for people without one yet. */
  role: EmailRole | null;
  /** The grey line next to the subject in the inbox. Under ~90 characters. */
  previewText: string;
  /** "You received this email because …" — say why, in plain words. */
  reason: string;
  /** Link to the recipient's notification settings, when they have any. */
  preferencesUrl?: string | null;
  children: React.ReactNode;
};

const MOBILE_CSS = `
@media only screen and (max-width: 520px) {
  .bb-pad { padding-left: 20px !important; padding-right: 20px !important; }
  .bb-h1 { font-size: 24px !important; line-height: 30px !important; }
  .bb-col { display: block !important; width: 100% !important; padding: 0 0 10px 0 !important; }
  .bb-btn { display: block !important; text-align: center !important; }
}`;

export function EmailFrame({
  role,
  previewText,
  reason,
  preferencesUrl,
  children,
}: EmailFrameProps) {
  const logo = `${assetBase()}/brandbite-logo-email.png`;
  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
        <style>{MOBILE_CSS}</style>
      </Head>
      <Preview>{previewText}</Preview>
      <Body
        style={{
          margin: 0,
          padding: "32px 12px",
          backgroundColor: frame.pageBg,
          fontFamily: fonts.body,
        }}
      >
        <Container
          style={{
            maxWidth: "600px",
            width: "100%",
            backgroundColor: frame.card,
            border: `1px solid ${frame.border}`,
            borderTop: `4px solid ${frame.accent}`,
            borderRadius: "16px",
            overflow: "hidden",
          }}
        >
          <Section
            className="bb-pad"
            style={{ padding: "24px 32px", borderBottom: `1px solid ${frame.border}` }}
          >
            <Img
              src={logo}
              alt="brandbite"
              width={140}
              style={{ display: "block", height: "auto" }}
            />
          </Section>

          <Section className="bb-pad" style={{ padding: "28px 32px 32px" }}>
            {role ? <RoleBadge role={role} /> : null}
            {children}
          </Section>

          <Section
            className="bb-pad"
            style={{
              padding: "20px 32px 24px",
              backgroundColor: frame.footerBg,
              borderTop: `1px solid ${frame.border}`,
            }}
          >
            <Text style={footerLine}>{reason}</Text>
            {preferencesUrl ? (
              <Text style={footerLine}>
                <Link href={preferencesUrl} style={footerLink}>
                  Manage email preferences
                </Link>
              </Text>
            ) : null}
            <Text style={footerLine}>
              {BRAND_LEGAL_NAME}
              {BRAND_ADDRESS ? ` · ${shortAddress(BRAND_ADDRESS)}` : ""}
            </Text>
            <Text style={footerLine}>
              <Link
                href={`mailto:${BRAND_SUPPORT_EMAIL}`}
                style={{ ...footerLink, textDecoration: "none" }}
              >
                {BRAND_SUPPORT_EMAIL}
              </Link>
            </Text>
            <Text style={footerLine}>
              <Link href={`${BRAND_WEBSITE}/support`} style={footerLink}>
                Support
              </Link>
              {"  ·  "}
              <Link href={`${BRAND_WEBSITE}/privacy`} style={footerLink}>
                Privacy
              </Link>
            </Text>
            <Text style={{ ...footerLine, margin: 0 }}>{copyrightLine()}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/** "Sharjah, United Arab Emirates" out of the full registered address. */
function shortAddress(address: string): string {
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.slice(-2).join(", ");
}

const footerLine: React.CSSProperties = {
  margin: "0 0 4px",
  fontSize: "13px",
  lineHeight: "20px",
  color: frame.muted,
};
const footerLink: React.CSSProperties = { color: frame.muted, textDecoration: "underline" };

/* ---------------------------------------------------------------------------
 * Pieces
 * ------------------------------------------------------------------------- */

export function RoleBadge({ role }: { role: EmailRole }) {
  const c = ROLE_COLORS[role];
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} style={{ marginBottom: "16px" }}>
      <tbody>
        <tr>
          <td
            style={{
              backgroundColor: c.bg,
              color: c.text,
              borderRadius: "999px",
              padding: "6px 14px",
              fontSize: "12px",
              lineHeight: "16px",
              fontWeight: 700,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              fontFamily: fonts.body,
            }}
          >
            {c.label}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  return (
    <h1
      className="bb-h1"
      style={{
        margin: "0 0 12px",
        fontSize: "30px",
        lineHeight: "36px",
        fontWeight: 800,
        letterSpacing: "-0.5px",
        color: frame.ink,
        fontFamily: fonts.heading,
      }}
    >
      {children}
    </h1>
  );
}

export function Body16({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <Text
      style={{
        margin: "0 0 16px",
        fontSize: "16px",
        lineHeight: "24px",
        color: muted ? frame.muted : frame.text,
      }}
    >
      {children}
    </Text>
  );
}

function IconChip({ name, tone, bg }: { name: IconName; tone: IconTone; bg: string }) {
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0}>
      <tbody>
        <tr>
          <td
            align="center"
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "999px",
              backgroundColor: bg,
              verticalAlign: "middle",
            }}
          >
            <Img
              src={iconUrl(name, tone)}
              alt=""
              width={22}
              height={22}
              style={{ display: "block", margin: "0 auto" }}
            />
          </td>
        </tr>
      </tbody>
    </table>
  );
}

type CardProps = {
  role: EmailRole;
  icon: IconName;
  /** Small label above the title, e.g. "Request". Optional. */
  label?: string;
  title: React.ReactNode;
  /** Shown right after the title, e.g. a "Success" pill. */
  aside?: React.ReactNode;
  /** "neutral" = grey header (secondary details, e.g. an audit table). */
  tone?: "role" | "neutral";
  /** Tint the body too, for a headline card like "Balance change". */
  filled?: boolean;
  children?: React.ReactNode;
};

/** The main card: header tinted in the role colour, white body. */
export function Card({
  role,
  icon,
  label,
  title,
  aside,
  tone = "role",
  filled = false,
  children,
}: CardProps) {
  const tint = tone === "neutral" ? neutralTint : roleCardTint[role];
  const iconTone: IconTone = tone === "neutral" ? "ink" : role;
  return (
    <table
      role="presentation"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      style={{
        width: "100%",
        margin: "8px 0 20px",
        border: `1px solid ${tint.border}`,
        borderRadius: "14px",
        borderCollapse: "separate",
        overflow: "hidden",
      }}
    >
      <tbody>
        <tr>
          <td
            style={{
              backgroundColor: tint.header,
              padding: "16px 20px",
              borderRadius: "14px 14px 0 0",
            }}
          >
            <table role="presentation" cellPadding={0} cellSpacing={0} width="100%">
              <tbody>
                <tr>
                  <td style={{ width: "52px", verticalAlign: "middle" }}>
                    <IconChip name={icon} tone={iconTone} bg="rgba(255,255,255,0.75)" />
                  </td>
                  <td style={{ verticalAlign: "middle" }}>
                    {label ? (
                      <div style={{ fontSize: "14px", lineHeight: "20px", color: frame.muted }}>
                        {label}
                      </div>
                    ) : null}
                    <div
                      style={{
                        fontSize: "22px",
                        lineHeight: "28px",
                        fontWeight: 700,
                        color: frame.ink,
                      }}
                    >
                      {title}
                      {aside ? <span style={{ marginLeft: "10px" }}>{aside}</span> : null}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
        {children ? (
          <tr>
            <td
              style={{
                backgroundColor: filled ? tint.header : frame.card,
                padding: filled ? "0 16px 6px" : "16px 16px 6px",
                borderRadius: "0 0 14px 14px",
              }}
            >
              {children}
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

export type Tile = { label: string; value: React.ReactNode; highlight?: boolean };

/** Label/value tiles, two per row (one per row on phones). */
export function Tiles({ tiles }: { tiles: Tile[] }) {
  const rows: Tile[][] = [];
  for (let i = 0; i < tiles.length; i += 2) rows.push(tiles.slice(i, i + 2));
  return (
    <table
      role="presentation"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      style={{ width: "100%" }}
    >
      <tbody>
        {rows.map((row, r) => (
          <tr key={r}>
            {row.map((tile, c) => (
              <td
                key={tile.label}
                className="bb-col"
                width="50%"
                style={{
                  width: "50%",
                  verticalAlign: "top",
                  padding: c === 0 ? "0 5px 10px 0" : "0 0 10px 5px",
                }}
              >
                <div
                  style={{
                    border: `1px solid ${frame.border}`,
                    borderRadius: "10px",
                    padding: "12px 16px",
                    backgroundColor: frame.card,
                  }}
                >
                  <div style={{ fontSize: "14px", lineHeight: "20px", color: frame.muted }}>
                    {tile.label}
                  </div>
                  <div
                    style={{
                      fontSize: "18px",
                      lineHeight: "26px",
                      fontWeight: 600,
                      color: tile.highlight ? frame.action : frame.ink,
                    }}
                  >
                    {tile.value}
                  </div>
                </div>
              </td>
            ))}
            {row.length === 1 ? (
              <td className="bb-col" width="50%" style={{ width: "50%" }} />
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A plain label → value table, for audit-style details. */
export function DetailRows({ rows }: { rows: { label: string; value: React.ReactNode }[] }) {
  return (
    <table
      role="presentation"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      style={{ width: "100%", marginBottom: "10px" }}
    >
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.label}>
            <td
              style={{
                width: "38%",
                padding: "8px 8px 8px 4px",
                fontSize: "15px",
                lineHeight: "22px",
                color: frame.muted,
                borderTop: i === 0 ? "none" : `1px solid ${frame.border}`,
                verticalAlign: "top",
              }}
            >
              {row.label}
            </td>
            <td
              style={{
                padding: "8px 4px",
                fontSize: "15px",
                lineHeight: "22px",
                color: frame.ink,
                borderTop: i === 0 ? "none" : `1px solid ${frame.border}`,
                wordBreak: "break-word",
              }}
            >
              {row.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** One file line: icon, name, size. */
export function FileRow({ name, meta }: { name: string; meta?: string }) {
  return (
    <table
      role="presentation"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      style={{
        width: "100%",
        marginBottom: "10px",
        border: `1px solid ${frame.border}`,
        borderRadius: "10px",
        borderCollapse: "separate",
      }}
    >
      <tbody>
        <tr>
          <td style={{ width: "56px", padding: "10px 0 10px 14px", verticalAlign: "middle" }}>
            <IconChip name="file" tone="ink" bg="#F4F2EE" />
          </td>
          <td style={{ padding: "10px 14px 10px 0", verticalAlign: "middle" }}>
            <div
              style={{
                fontSize: "16px",
                lineHeight: "22px",
                fontWeight: 600,
                color: frame.ink,
                wordBreak: "break-all",
              }}
            >
              {name}
            </div>
            {meta ? (
              <div style={{ fontSize: "14px", lineHeight: "20px", color: frame.muted }}>{meta}</div>
            ) : null}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** A small rounded status pill, e.g. "Success". */
export function Pill({
  children,
  tone = "success",
}: {
  children: React.ReactNode;
  tone?: "success";
}) {
  const c = frame[tone];
  return (
    <span
      style={{
        display: "inline-block",
        backgroundColor: c.bg,
        color: c.text,
        borderRadius: "999px",
        padding: "2px 12px",
        fontSize: "14px",
        lineHeight: "22px",
        fontWeight: 600,
        verticalAlign: "middle",
      }}
    >
      {children}
    </span>
  );
}

type CalloutProps = {
  tone?: "info" | "warning";
  title?: string;
  /** Regular-weight text without a title (longer notes). */
  plain?: boolean;
  children: React.ReactNode;
};

/** Blue note ("Getting started") or amber warning ("will be deleted"). */
export function Notice({ tone = "info", title, plain = false, children }: CalloutProps) {
  const c = frame[tone];
  const quiet = Boolean(title) || plain;
  return (
    <table
      role="presentation"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      style={{
        width: "100%",
        margin: "0 0 20px",
        backgroundColor: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: "12px",
        borderCollapse: "separate",
      }}
    >
      <tbody>
        <tr>
          <td style={{ width: "56px", padding: "14px 0 14px 16px", verticalAlign: "middle" }}>
            <IconChip
              name={tone === "info" ? "info" : "alert"}
              tone={tone}
              bg="rgba(255,255,255,0.6)"
            />
          </td>
          <td style={{ padding: "14px 18px 14px 4px", verticalAlign: "middle" }}>
            {title ? (
              <div
                style={{ fontSize: "17px", lineHeight: "24px", fontWeight: 700, color: c.title }}
              >
                {title}
              </div>
            ) : null}
            <div
              style={{
                fontSize: quiet ? "15px" : "17px",
                lineHeight: quiet ? "22px" : "24px",
                fontWeight: quiet ? 400 : 700,
                color: c.text,
              }}
            >
              {children}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

type ActionsProps = {
  href: string;
  label: string;
  /** An underlined link under the button, e.g. "Open your board". */
  secondary?: { href: string; label: string } | null;
  /** A short line under the button, e.g. "If you didn't expect this…". */
  note?: string;
};

export function Actions({ href, label, secondary, note }: ActionsProps) {
  return (
    <Section style={{ margin: "4px 0 0" }}>
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
                {label}
              </Link>
            </td>
          </tr>
        </tbody>
      </table>
      {secondary ? (
        <Text style={{ margin: "14px 0 0", fontSize: "16px", lineHeight: "22px" }}>
          <Link
            href={secondary.href}
            style={{ color: frame.action, fontWeight: 600, textDecoration: "underline" }}
          >
            {secondary.label}
          </Link>
        </Text>
      ) : null}
      {note ? (
        <Text
          style={{ margin: "12px 0 0", fontSize: "15px", lineHeight: "22px", color: frame.text }}
        >
          {note}
        </Text>
      ) : null}
    </Section>
  );
}
