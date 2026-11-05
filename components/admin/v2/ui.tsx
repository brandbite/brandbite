// -----------------------------------------------------------------------------
// @file: components/admin/v2/ui.tsx
// @purpose: Shared building blocks for admin pages on design language v1.
//           Everything reads the `.bb-admin-v2` tokens (globals.css), so it
//           works in light + dark without per-page colour logic.
//
//           Type scale (guide): page title 32/40 700 · KPI value 32/40 700 ·
//           panel title 24/32 700 · card title 20/28 600 · subsection 18/26
//           600 · body 16/24 · table/menu 14/20 · label/button 14/20 500-600
//           · secondary/badge 12/16. Never below 12px.
//           Geometry: card radius 16, controls radius 8, control height 40,
//           card padding 24 (16 in dense tables), 1px borders, no shadows.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { IconAlertCircle, IconArrowUpRight, IconChevronDown, IconSearch } from "./icons";
import { IconX } from "@/components/navigation/nav-icons";

const cx = (...c: unknown[]) =>
  c.filter((x): x is string => typeof x === "string" && x.length > 0).join(" ");

const FOCUS =
  "focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:ring-offset-1 focus-visible:outline-none";

// ---------------------------------------------------------------------------
// Page scaffolding
// ---------------------------------------------------------------------------

export function PageHeader({
  title,
  description,
  actions,
  meta,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Right-aligned buttons / toggles. */
  actions?: ReactNode;
  /** Small summary line under the description (counts, timezone…). */
  meta?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[32px] leading-10 font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-base text-[var(--av2-text-2)]">{description}</p>}
        {meta && <div className="mt-3 text-sm text-[var(--av2-text-2)]">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({
  children,
  className,
  padding = "md",
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  /** md = 24px, sm = 16px (dense tables), none = flush (tables). */
  padding?: "md" | "sm" | "none";
  as?: "section" | "div" | "article";
}) {
  return (
    <Tag
      className={cx(
        "rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)]",
        padding === "md" && "p-6",
        padding === "sm" && "p-4",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function CardTitle({
  children,
  action,
  description,
}: {
  children: ReactNode;
  action?: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-xl leading-7 font-semibold">{children}</h2>
        {description && <p className="mt-0.5 text-sm text-[var(--av2-text-2)]">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Uppercase micro-label for short group names only (guide). */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-medium tracking-[0.12em] text-[var(--av2-text-2)] uppercase">
      {children}
    </p>
  );
}

/** List on the left, sticky detail panel on the right (stacks below xl). */
export function SplitView({ children, panel }: { children: ReactNode; panel?: ReactNode }) {
  return (
    <div
      className={cx(
        "grid items-start gap-6",
        panel && "xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]",
      )}
    >
      <div className="min-w-0">{children}</div>
      {panel}
    </div>
  );
}

export function DetailPanel({
  title,
  onClose,
  children,
  footer,
  closeLabel = "Close details",
}: {
  title: ReactNode;
  onClose?: () => void;
  children: ReactNode;
  /** Sticky action area (save bar) at the bottom of the panel. */
  footer?: ReactNode;
  closeLabel?: string;
}) {
  return (
    <aside className="flex flex-col rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)] xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)]">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--av2-border)] px-6 py-5">
        <h2 className="text-xl leading-7 font-semibold">{title}</h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className={cx(
              "flex h-9 w-9 items-center justify-center rounded-lg text-[var(--av2-text-2)] hover:bg-[var(--av2-bg)]",
              FOCUS,
            )}
          >
            <IconX width={18} height={18} />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
      {footer && <div className="border-t border-[var(--av2-border)] px-6 py-4">{footer}</div>}
    </aside>
  );
}

/** Section inside a detail panel / card, separated by a hairline. */
export function PanelSection({
  title,
  children,
  action,
}: {
  title?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="border-t border-[var(--av2-border)] py-5 first:border-t-0 first:pt-0 last:pb-0">
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h3 className="text-base font-semibold">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

/** Label / value rows (definition list). */
export function KeyValueList({ rows }: { rows: { label: ReactNode; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-x-4 gap-y-3 text-sm">
      {rows.map((r, i) => (
        <div key={i} className="contents">
          <dt className="text-[var(--av2-text-2)]">{r.label}</dt>
          <dd className="min-w-0 font-medium break-words">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export type Tone = "neutral" | "lavender" | "peach" | "green" | "red" | "amber" | "blue";

const TILE_TONE: Record<Tone, string> = {
  neutral: "bg-[var(--av2-bg)] text-[var(--av2-text-2)]",
  lavender: "bg-[var(--av2-lavender-bg)] text-[#5b4fc4] dark:text-[#b8adf7]",
  peach: "bg-[var(--av2-selected)] text-[var(--av2-link)]",
  green: "bg-[var(--av2-success-bg)] text-[#2f7a45] dark:text-[#7fd396]",
  red: "bg-[#fde3e1] text-[var(--av2-error)] dark:bg-[#3a1715]",
  amber: "bg-[#feead3] text-[#b25e09] dark:bg-[#37250f] dark:text-[#f2a33a]",
  blue: "bg-[#e6f0ff] text-[#2858b8] dark:bg-[#132440] dark:text-[#8db4ff]",
};

export function IconTile({
  children,
  tone,
  size = 48,
  round = false,
}: {
  children: ReactNode;
  tone: Tone;
  size?: number;
  round?: boolean;
}) {
  return (
    <span
      style={{ width: size, height: size }}
      className={cx(
        "inline-flex shrink-0 items-center justify-center",
        round ? "rounded-full" : "rounded-xl",
        TILE_TONE[tone],
      )}
    >
      {children}
    </span>
  );
}

export function KpiCard({
  icon,
  tone,
  label,
  value,
  hint,
  highlight = false,
  action,
}: {
  icon?: ReactNode;
  tone?: Tone;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  highlight?: boolean;
  /** Small link in the card's top-right corner. */
  action?: ReactNode;
}) {
  return (
    <section
      className={cx(
        "relative flex gap-4 overflow-hidden rounded-2xl border bg-[var(--av2-surface)] p-6",
        highlight ? "border-[var(--av2-accent)]/40" : "border-[var(--av2-border)]",
      )}
    >
      {highlight && (
        <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-[var(--av2-accent)]" />
      )}
      {icon && <IconTile tone={tone ?? "neutral"}>{icon}</IconTile>}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <Eyebrow>{label}</Eyebrow>
          {action}
        </div>
        <p className="mt-1 text-[32px] leading-10 font-bold tracking-tight tabular-nums">{value}</p>
        {hint && <div className="mt-1 text-xs text-[var(--av2-text-2)]">{hint}</div>}
      </div>
    </section>
  );
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="mb-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

// ---------------------------------------------------------------------------
// Badges & status
// ---------------------------------------------------------------------------

const BADGE_TONE: Record<Tone, string> = {
  neutral: "bg-[var(--av2-track)] text-[var(--av2-text)]",
  lavender: "bg-[var(--av2-lavender-bg)] text-[#4b3fb0] dark:text-[#c3b9fa]",
  peach:
    "bg-[var(--av2-selected)] text-[#a83210] ring-1 ring-[var(--av2-accent)]/30 ring-inset dark:text-[#ff8a5f]",
  green: "bg-[var(--av2-success-bg)] text-[#256b3a] dark:text-[#7fd396]",
  red: "bg-[#fde3e1] text-[var(--av2-error-text)] dark:bg-[#3a1715]",
  amber: "bg-[#fff1d6] text-[#8a5300] dark:bg-[#37250f] dark:text-[#f2b35a]",
  blue: "bg-[#e6f0ff] text-[#1f4fa8] dark:bg-[#132440] dark:text-[#8db4ff]",
};

const DOT_TONE: Record<Tone, string> = {
  neutral: "var(--av2-fill-neutral)",
  lavender: "var(--av2-fill-lavender)",
  peach: "var(--av2-fill-orange)",
  green: "var(--av2-fill-green)",
  red: "var(--av2-fill-red)",
  amber: "var(--av2-fill-amber)",
  blue: "#5b8def",
};

/** Text badge. Colour is never the only signal — always pass a label. */
export function Badge({
  tone = "neutral",
  dot = false,
  icon,
  children,
  className,
}: {
  tone?: Tone;
  dot?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        BADGE_TONE[tone],
        className,
      )}
    >
      {dot && (
        <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: DOT_TONE[tone] }} />
      )}
      {icon}
      {children}
    </span>
  );
}

/** Ticket workflow status → badge (guide mapping). */
export const TICKET_STATUS: Record<string, { label: string; tone: Tone }> = {
  TODO: { label: "Backlog", tone: "neutral" },
  IN_PROGRESS: { label: "In progress", tone: "lavender" },
  IN_REVIEW: { label: "In review", tone: "peach" },
  DONE: { label: "Done", tone: "green" },
};

export const PRIORITY: Record<string, { label: string; tone: Tone }> = {
  URGENT: { label: "Urgent", tone: "red" },
  HIGH: { label: "High", tone: "amber" },
  MEDIUM: { label: "Medium", tone: "lavender" },
  LOW: { label: "Low", tone: "neutral" },
};

export function StatusDot({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span
        aria-hidden
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: DOT_TONE[tone] }}
      />
      {label}
    </span>
  );
}

export function Avatar({
  name,
  size = 32,
  tone = "peach",
}: {
  name: string | null | undefined;
  size?: number;
  tone?: Tone;
}) {
  const initials =
    (name ?? "")
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "?";
  return (
    <span
      aria-hidden
      title={name ?? undefined}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.36) }}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        TILE_TONE[tone],
      )}
    >
      {initials}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--av2-accent-strong)] text-white hover:brightness-110 disabled:bg-[var(--av2-track)] disabled:text-[var(--av2-text-2)] disabled:hover:brightness-100",
  secondary:
    "border border-[var(--av2-border)] bg-[var(--av2-surface)] text-[var(--av2-text)] hover:bg-[var(--av2-bg)] disabled:bg-[var(--av2-bg)] disabled:text-[var(--av2-text-2)] disabled:opacity-60 disabled:hover:bg-[var(--av2-bg)]",
  ghost:
    "text-[var(--av2-text)] hover:bg-[var(--av2-bg)] disabled:text-[var(--av2-text-2)] disabled:opacity-60",
  danger:
    "border border-[var(--av2-error)]/40 bg-[var(--av2-surface)] text-[var(--av2-error-text)] hover:bg-[#fde3e1] dark:hover:bg-[#3a1715] disabled:opacity-50",
};

export function buttonClass(variant: ButtonVariant = "secondary", size: "md" | "sm" = "md") {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap transition disabled:cursor-not-allowed",
    size === "md" ? "h-10 px-4 text-sm" : "h-8 px-3 text-xs",
    BUTTON_VARIANT[variant],
    FOCUS,
  );
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "md" | "sm" }
>(function Button({ variant = "secondary", size = "md", className, type, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={cx(buttonClass(variant, size), className)}
      {...rest}
    />
  );
});

export function ButtonLink({
  href,
  variant = "secondary",
  size = "md",
  children,
  className,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: "md" | "sm";
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={cx(buttonClass(variant, size), className)}>
      {children}
    </Link>
  );
}

/** Inline orange link with the ↗ glyph (guide: "View tickets ↗"). */
export function TextLink({
  href,
  children,
  external = false,
  arrow = true,
}: {
  href: string;
  children: ReactNode;
  external?: boolean;
  arrow?: boolean;
}) {
  const cls = cx(
    "inline-flex items-center gap-1 rounded text-sm font-semibold whitespace-nowrap text-[var(--av2-link)] hover:underline",
    FOCUS,
  );
  const body = (
    <>
      {children}
      {arrow && <IconArrowUpRight />}
    </>
  );
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {body}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {body}
    </Link>
  );
}

/** Two-option (or more) pill toggle, e.g. Kanban / Table. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: ReactNode; href?: string }[];
  value: T;
  onChange?: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-full border border-[var(--av2-border)] bg-[var(--av2-surface)] p-1"
    >
      {options.map((o) => {
        const active = o.value === value;
        const cls = cx(
          "inline-flex h-8 items-center rounded-full px-4 text-sm font-medium transition-colors",
          active
            ? "bg-[var(--av2-text)] text-[var(--av2-surface)]"
            : "text-[var(--av2-text-2)] hover:text-[var(--av2-text)]",
          FOCUS,
        );
        return o.href ? (
          <Link
            key={o.value}
            href={o.href}
            aria-current={active ? "page" : undefined}
            className={cls}
          >
            {o.label}
          </Link>
        ) : (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange?.(o.value)}
            className={cls}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Status filter pills with counts ("All · 2", "Pending · 0"). */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; count?: number | null }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cx(
              "inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors",
              active
                ? "border-[var(--av2-text)] bg-[var(--av2-text)] text-[var(--av2-surface)]"
                : "border-[var(--av2-border)] bg-[var(--av2-surface)] text-[var(--av2-text)] hover:bg-[var(--av2-bg)]",
              FOCUS,
            )}
          >
            {o.label}
            {o.count != null && <span className="tabular-nums opacity-80">· {o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Underlined tabs. Pass `panelId` to wire aria-controls on the active tab. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  idPrefix,
}: {
  tabs: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  idPrefix?: string;
}) {
  const autoId = useId();
  const prefix = idPrefix ?? autoId;
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = tabs.findIndex((t) => t.value === value);
    const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    onChange(next.value);
    requestAnimationFrame(() => document.getElementById(`${prefix}-tab-${next.value}`)?.focus());
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKey}
      className="flex gap-6 overflow-x-auto overflow-y-hidden border-b border-[var(--av2-border)]"
    >
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            id={`${prefix}-tab-${t.value}`}
            role="tab"
            type="button"
            aria-selected={active}
            aria-controls={`${prefix}-panel-${t.value}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={cx(
              "-mb-px border-b-2 px-1 pt-1 pb-3 text-sm font-semibold whitespace-nowrap transition-colors",
              active
                ? "border-[var(--av2-accent)] text-[var(--av2-link)]"
                : "border-transparent text-[var(--av2-text-2)] hover:text-[var(--av2-text)]",
              FOCUS,
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** Wrap each tab's content so the tablist's aria-controls resolve. */
export function TabPanel({
  idPrefix,
  value,
  children,
}: {
  idPrefix: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${value}`}
      aria-labelledby={`${idPrefix}-tab-${value}`}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

const CONTROL =
  "h-10 w-full rounded-lg border border-[var(--av2-border)] bg-[var(--av2-surface)] px-3 text-sm text-[var(--av2-text)] placeholder:text-[var(--av2-text-2)] disabled:cursor-not-allowed disabled:bg-[var(--av2-bg)] disabled:text-[var(--av2-text-2)] aria-[invalid=true]:border-[var(--av2-error)] focus:border-[var(--av2-accent)] focus:ring-2 focus:ring-[var(--av2-accent)]/25 focus:outline-none";

/** Label + control + hint/error. Error copy uses --av2-error-text + an icon. */
export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-[var(--av2-error-text)]">
          <IconAlertCircle width={14} height={14} className="mt-px shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-[var(--av2-text-2)]">{hint}</p>
      ) : null}
    </div>
  );
}

export const TextInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { suffix?: ReactNode }
>(function TextInput({ className, suffix, ...rest }, ref) {
  if (!suffix) return <input ref={ref} className={cx(CONTROL, className)} {...rest} />;
  return (
    <div className="relative">
      <input ref={ref} className={cx(CONTROL, "pr-16", className)} {...rest} />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-[var(--av2-text-2)]">
        {suffix}
      </span>
    </div>
  );
});

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea({ className, ...rest }, ref) {
  return (
    <textarea ref={ref} className={cx(CONTROL, "h-auto min-h-24 py-2", className)} {...rest} />
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <div className="relative">
        <select ref={ref} className={cx(CONTROL, "appearance-none pr-9", className)} {...rest}>
          {children}
        </select>
        <IconChevronDown className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[var(--av2-text-2)]" />
      </div>
    );
  },
);

export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  /** Accessible name (visually the placeholder carries it). */
  label: string;
  className?: string;
}) {
  return (
    <div className={cx("relative", className)}>
      <IconSearch
        width={18}
        height={18}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--av2-text-2)]"
      />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cx(CONTROL, "pl-10")}
      />
    </div>
  );
}

/**
 * On/off toggle (role="switch"). Name it with `label` (visible text next to
 * it) or `labelledBy` (id of an existing label element).
 */
export function Switch({
  checked,
  onChange,
  label,
  labelledBy,
  describedBy,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  labelledBy?: string;
  describedBy?: string;
  disabled?: boolean;
}) {
  const autoId = useId();
  const labelId = labelledBy ?? (label ? `${autoId}-label` : undefined);
  const button = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-[var(--av2-accent-strong)]" : "bg-[var(--av2-fill-neutral)]",
        FOCUS,
      )}
    >
      <span
        aria-hidden
        className={cx(
          "inline-block h-5 w-5 rounded-full bg-white transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
  if (!label) return button;
  return (
    <span className="inline-flex items-center gap-3">
      {button}
      <span id={labelId} className="text-sm font-medium">
        {label}
      </span>
    </span>
  );
}

/** Row of filters above a list: search + selects + trailing count. */
export function FilterBar({ children, trailing }: { children: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      {children}
      {trailing && <div className="ml-auto text-sm text-[var(--av2-text-2)]">{trailing}</div>}
    </div>
  );
}

/** Footer for editors: dirty-state text on the left, actions on the right. */
export function SaveBar({
  dirty,
  status,
  children,
}: {
  dirty: boolean;
  /** Override the default "No unsaved changes" / "Unsaved changes" copy. */
  status?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p role="status" className="min-w-[12rem] flex-1 text-sm text-[var(--av2-text-2)]">
        {status ?? (dirty ? "Unsaved changes" : "No unsaved changes")}
      </p>
      <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export function Table({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="overflow-x-auto">
      <table aria-label={label} className="w-full border-collapse text-left text-sm">
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  align = "left",
  className,
}: {
  children?: ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cx(
        "border-b border-[var(--av2-border)] px-4 py-3 text-xs font-medium tracking-[0.08em] whitespace-nowrap text-[var(--av2-text-2)] uppercase first:pl-6 last:pr-6",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  className,
}: {
  children?: ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  return (
    <td
      className={cx(
        "px-4 py-4 align-middle first:pl-6 last:pr-6",
        align === "right" && "text-right tabular-nums",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </td>
  );
}

/**
 * Table row. `selected` paints the row with the selected fill + an accent
 * bar on the left; `onSelect` makes the whole row clickable and keyboard
 * reachable (Enter / Space).
 */
export function Tr({
  children,
  selected = false,
  onSelect,
  label,
}: {
  children: ReactNode;
  selected?: boolean;
  onSelect?: () => void;
  /** Accessible name when the row is selectable. */
  label?: string;
}) {
  return (
    <tr
      onClick={onSelect}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
      tabIndex={onSelect ? 0 : undefined}
      aria-selected={onSelect ? selected : undefined}
      aria-label={onSelect ? label : undefined}
      className={cx(
        "border-b border-[var(--av2-border)] last:border-b-0",
        onSelect && "cursor-pointer hover:bg-[var(--av2-bg)]",
        selected &&
          "bg-[var(--av2-selected)] shadow-[inset_3px_0_0_var(--av2-accent)] hover:bg-[var(--av2-selected)]",
        onSelect &&
          "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--av2-accent)]",
      )}
    >
      {children}
    </tr>
  );
}

/** "Showing 4 of 4 companies" + optional pager. */
export function TableFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--av2-border)] px-6 py-4 text-sm text-[var(--av2-text-2)]">
      {children}
    </div>
  );
}

export function Pager({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (p: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center gap-2">
      <Button size="sm" onClick={() => onPage(page - 1)} disabled={page <= 1}>
        Previous
      </Button>
      <span className="tabular-nums">
        Page {page} of {pageCount}
      </span>
      <Button size="sm" onClick={() => onPage(page + 1)} disabled={page >= pageCount}>
        Next
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

/**
 * Empty / zero-result state. Keep "nothing exists yet" and "nothing matches
 * these filters" as different copy (guide).
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icon && (
        <IconTile tone="peach" size={64} round>
          {icon}
        </IconTile>
      )}
      <p className={cx("text-lg font-semibold", icon && "mt-4")}>{title}</p>
      {description && (
        <p className="mt-1 max-w-md text-sm text-[var(--av2-text-2)]">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Inline callout. Warning/error always carry an icon + title, not colour alone. */
export function Callout({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: "info" | "warning" | "error" | "success";
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const styles = {
    info: "border-[var(--av2-border)] bg-[var(--av2-bg)]",
    warning: "border-[var(--av2-attention-border)] bg-[var(--av2-attention-from)]",
    error: "border-[var(--av2-error)]/30 bg-[#fdf0ef] dark:bg-[#2a1212]",
    success: "border-[var(--av2-fill-green)]/40 bg-[var(--av2-success-bg)]",
  }[tone];
  const iconColor = {
    info: "text-[var(--av2-text-2)]",
    warning: "text-[var(--av2-link)]",
    error: "text-[var(--av2-error)]",
    success: "text-[#2f7a45] dark:text-[#7fd396]",
  }[tone];
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cx("flex items-start gap-3 rounded-xl border p-4", styles)}
    >
      <IconAlertCircle className={cx("mt-0.5 shrink-0", iconColor)} />
      <div className="min-w-0 flex-1 text-sm">
        {title && <p className="font-semibold">{title}</p>}
        {children && (
          <div className={cx("text-[var(--av2-text-2)]", title && "mt-0.5")}>{children}</div>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Pulsing placeholder block for loading states. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cx("animate-pulse rounded-lg bg-[var(--av2-track)]", className)} />
  );
}

export const DASH = "—";

/** Number or em dash — never turn missing data into 0 (guide). */
export const fmt = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? n.toLocaleString() : DASH;

export const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
