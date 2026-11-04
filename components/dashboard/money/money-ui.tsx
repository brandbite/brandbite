// -----------------------------------------------------------------------------
// @file: components/dashboard/money/money-ui.tsx
// @purpose: Formatting and small building blocks shared by the catalog, token and
//           withdrawal screens of the customer and creative dashboards. Missing
//           numbers render as a dash, never as 0.
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useRef, type ReactNode } from "react";

import {
  Badge,
  Button,
  DASH,
  Eyebrow,
  fmt,
  IconTile,
  plural,
  TableFooter,
  type Tone,
} from "@/components/admin/v2/ui";

export type LedgerDirection = "CREDIT" | "DEBIT";
export type WithdrawalStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAID";

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** "1,234 tokens", or a dash when the number is missing. */
export function formatTokens(n: number | null | undefined): string {
  return typeof n === "number" && Number.isFinite(n)
    ? `${fmt(n)} ${plural(n, "token", "tokens")}`
    : DASH;
}

export function formatSignedTokens(direction: LedgerDirection, amount: number): string {
  return `${direction === "CREDIT" ? "+" : "−"}${formatTokens(amount)}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return DASH;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return DASH;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const REASON_LABELS: Record<string, string> = {
  ADMIN_ADJUSTMENT: "Adjustment",
  TOKEN_TOPUP: "Token top-up",
  WITHDRAW: "Withdrawal",
};

/** Ledger reasons are stored as codes (AI_REFUND); free text passes through. */
export function formatLedgerReason(reason: string | null | undefined): string {
  if (!reason) return DASH;
  if (REASON_LABELS[reason]) return REASON_LABELS[reason];
  if (!/^[A-Z0-9_]+$/.test(reason)) return reason;
  const words = reason.toLowerCase().split("_").join(" ");
  const sentence = words.charAt(0).toUpperCase() + words.slice(1);
  return sentence.replace(/\bai\b/gi, "AI");
}

// ---------------------------------------------------------------------------
// Status badges
// ---------------------------------------------------------------------------

export function DirectionBadge({ direction }: { direction: LedgerDirection }) {
  return direction === "CREDIT" ? (
    <Badge tone="green">Credit</Badge>
  ) : (
    <Badge tone="red">Debit</Badge>
  );
}

/** Approved means an admin agreed to pay. Only Paid gets the green "money moved" tone. */
export const WITHDRAWAL_STATUS: Record<WithdrawalStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending", tone: "amber" },
  APPROVED: { label: "Approved", tone: "blue" },
  PAID: { label: "Paid", tone: "green" },
  REJECTED: { label: "Rejected", tone: "red" },
};

export function WithdrawalBadge({ status }: { status: WithdrawalStatus }) {
  const s = WITHDRAWAL_STATUS[status];
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  );
}

/** A running balance that was never recorded stays visibly unknown. */
export function RecordedBalance({ value }: { value: number | null | undefined }) {
  if (typeof value === "number") return <>{formatTokens(value)}</>;
  return (
    <span className="whitespace-nowrap text-[var(--av2-text-2)]">
      {DASH} <span className="text-xs italic">Not recorded</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

/**
 * Big number for a KpiCard. Ten or more digits step down one size so they stay
 * whole in a narrow card instead of being clipped.
 */
export function TokenFigure({
  value,
  unit = true,
}: {
  value: number | null | undefined;
  unit?: boolean;
}) {
  if (typeof value !== "number" || !Number.isFinite(value)) return <>{DASH}</>;
  const long = String(Math.abs(Math.trunc(value))).length >= 10;
  return (
    <>
      <span className={long ? "text-2xl leading-10" : undefined}>{fmt(value)}</span>
      {unit ? (
        <span className="text-xl font-semibold"> {plural(value, "token", "tokens")}</span>
      ) : null}
    </>
  );
}

/**
 * Metric card for narrow columns: icon and label share a row, the value gets the
 * full width below, and `children` can hold a breakdown.
 */
export function MoneyStat({
  icon,
  tone = "neutral",
  label,
  value,
  hint,
  action,
  children,
}: {
  icon?: ReactNode;
  tone?: Tone;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-6">
      <div className="flex min-h-10 items-center gap-3">
        {icon ? (
          <IconTile tone={tone} size={40}>
            {icon}
          </IconTile>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <Eyebrow>{label}</Eyebrow>
          {action}
        </div>
      </div>
      <p className="mt-3 text-[32px] leading-10 font-bold tracking-tight break-words tabular-nums">
        {value}
      </p>
      {hint ? <div className="mt-1 text-sm text-[var(--av2-text-2)]">{hint}</div> : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

export function MiniStat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-[var(--av2-bg)] px-3 py-2">
      <p className="text-base leading-6 font-bold tabular-nums">{value}</p>
      <p className="text-xs text-[var(--av2-text-2)]">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

export function pageOf<T>(items: T[], page: number, size: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(page, 1), pageCount);
  const start = (current - 1) * size;
  return {
    rows: items.slice(start, start + size),
    page: current,
    pageCount,
    from: items.length === 0 ? 0 : start + 1,
    to: Math.min(start + size, items.length),
    total: items.length,
  };
}

/** "Showing 1–6 of 11" and full-height (40px) previous / next buttons. */
export function ListFooter({
  from,
  to,
  total,
  page,
  pageCount,
  onPage,
  note,
}: {
  from: number;
  to: number;
  total: number;
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
  note?: ReactNode;
}) {
  return (
    <TableFooter>
      <p>
        Showing {fmt(from)}–{fmt(to)} of {fmt(total)}
        {note ? <span className="block text-xs">{note}</span> : null}
      </p>
      {pageCount > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => onPage(page - 1)} disabled={page <= 1}>
            Previous
          </Button>
          <span className="px-1 tabular-nums">
            Page {page} of {pageCount}
          </span>
          <Button onClick={() => onPage(page + 1)} disabled={page >= pageCount}>
            Next
          </Button>
        </div>
      ) : null}
    </TableFooter>
  );
}

/**
 * Below the `xl` breakpoint the detail panel stacks under the list, out of view.
 * Attach `ref` to a `scroll-mt-20 xl:contents` wrapper around the panel (`contents`
 * keeps the panel's sticky behaviour beside the list) and call `reveal` on selection.
 */
export function useRevealPanel() {
  const ref = useRef<HTMLDivElement>(null);
  const reveal = useCallback(() => {
    if (!window.matchMedia?.("(max-width: 1279px)").matches) return;
    requestAnimationFrame(() => ref.current?.scrollIntoView?.({ block: "start" }));
  }, []);
  return { ref, reveal };
}
