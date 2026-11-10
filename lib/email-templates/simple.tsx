// -----------------------------------------------------------------------------
// @file: lib/email-templates/simple.tsx
// @purpose: A data-driven email on the shared frame, for the emails that
//           used to be hand-written HTML strings (admin receipts and alerts,
//           security codes, invites, password resets). Callers describe the
//           content; the frame does the rest. React escapes every value, so
//           user-provided text (names, notes, metadata) is safe to pass in.
// -----------------------------------------------------------------------------

import * as React from "react";
import { Link } from "@react-email/components";
import { render } from "@react-email/render";

import {
  Actions,
  Body16,
  Card,
  DetailRows,
  EmailFrame,
  Notice,
  Pill,
  Tiles,
  Title,
  frame,
  type EmailRole,
  type IconName,
  type Tile,
} from "./frame";

export type SimpleEmailCard = {
  icon: IconName;
  label?: string;
  title: string;
  pill?: string;
  tone?: "role" | "neutral";
  filled?: boolean;
  tiles?: Tile[];
  rows?: { label: string; value: string }[];
};

export type SimpleEmailSpec = {
  role: EmailRole | null;
  previewText: string;
  reason: string;
  preferencesUrl?: string | null;
  title: string;
  /** Paragraphs under the title. */
  intro?: string[];
  /** Amber warning right under the title (before the intro). */
  warning?: string;
  cards?: SimpleEmailCard[];
  /** Blue note after the cards. */
  note?: { title?: string; text: string };
  /** A big code, e.g. a sign-in code, shown on its own. */
  code?: string;
  action?: { href: string; label: string };
  secondary?: { href: string; label: string } | null;
  /** Small line under the button. */
  footnote?: string;
};

function Code({ value }: { value: string }) {
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} style={{ margin: "4px 0 20px" }}>
      <tbody>
        <tr>
          <td
            style={{
              backgroundColor: "#F4F2EE",
              border: "1px solid #E6E2DC",
              borderRadius: "12px",
              padding: "14px 24px",
              fontSize: "32px",
              lineHeight: "38px",
              fontWeight: 700,
              letterSpacing: "8px",
              color: "#1F1E1D",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            }}
          >
            {value}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function SimpleEmail(spec: SimpleEmailSpec) {
  const role = spec.role;
  return (
    <EmailFrame
      role={role}
      previewText={spec.previewText}
      reason={spec.reason}
      preferencesUrl={spec.preferencesUrl ?? null}
    >
      <Title>{spec.title}</Title>
      {spec.warning ? <Notice tone="warning">{spec.warning}</Notice> : null}
      {(spec.intro ?? []).map((p, i) => (
        <Body16 key={i}>{p}</Body16>
      ))}
      {spec.code ? <Code value={spec.code} /> : null}
      {(spec.cards ?? []).map((card, i) => (
        <Card
          key={i}
          role={role ?? "admin"}
          tone={role ? (card.tone ?? "role") : "neutral"}
          filled={card.filled}
          icon={card.icon}
          label={card.label}
          title={card.title}
          aside={card.pill ? <Pill>{card.pill}</Pill> : undefined}
        >
          {card.tiles?.length ? <Tiles tiles={card.tiles} /> : null}
          {card.rows?.length ? <DetailRows rows={card.rows} /> : null}
        </Card>
      ))}
      {spec.note ? (
        <Notice title={spec.note.title} plain>
          {spec.note.text}
        </Notice>
      ) : null}
      {spec.action ? (
        <Actions
          href={spec.action.href}
          label={spec.action.label}
          secondary={spec.secondary ?? null}
          note={spec.footnote}
        />
      ) : (
        <>
          {spec.footnote ? <Body16>{spec.footnote}</Body16> : null}
          {spec.secondary ? (
            <Body16>
              <Link
                href={spec.secondary.href}
                style={{ color: frame.cta, fontWeight: 600, textDecoration: "underline" }}
              >
                {spec.secondary.label}
              </Link>
            </Body16>
          ) : null}
        </>
      )}
    </EmailFrame>
  );
}

export function renderSimpleEmail(spec: SimpleEmailSpec): Promise<string> {
  return render(React.createElement(SimpleEmail, spec));
}
