// -----------------------------------------------------------------------------
// @file: components/blocks/admin/block-form-ui.tsx
// @purpose: Small v2 (admin design language v1) building blocks shared by
//           the page-block admin forms on /admin/landing and /admin/site:
//           section headings, repeater rows, icon-only reorder buttons, the
//           save footer (error callout + SaveBar), a dirty-state hook, and
//           the two client switchers the server pages use (vertical section
//           selector for the landing page, underlined tabs for site chrome).
//
//           Everything here is presentation only — no data fetching, no
//           payload shaping. Panels stay mounted (`hidden`) so unsaved edits
//           survive switching sections.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useId, useState, type ReactNode, type SVGProps } from "react";

import { Button, Callout, SaveBar, Tabs, TabPanel } from "@/components/admin/v2/ui";

const cx = (...c: unknown[]) =>
  c.filter((x): x is string => typeof x === "string" && x.length > 0).join(" ");

// ---------------------------------------------------------------------------
// Dirty state
// ---------------------------------------------------------------------------

/**
 * Compares a serialised snapshot of the form against the last saved one.
 * `markSaved` re-baselines to the snapshot of the render it was created in,
 * so edits made while a save is in flight still count as unsaved.
 */
export function useDirtyBaseline(snapshot: string) {
  const [baseline, setBaseline] = useState(snapshot);
  return { dirty: snapshot !== baseline, markSaved: () => setBaseline(snapshot) };
}

// ---------------------------------------------------------------------------
// Layout bits
// ---------------------------------------------------------------------------

/** Hairline-separated group inside a block form. */
export function FormSection({
  title,
  description,
  count,
  action,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  /** e.g. "3 / 5" — shown next to the title. */
  count?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="border-t border-[var(--av2-border)] pt-6 first:border-t-0 first:pt-0">
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h3 className="text-base font-semibold">
                {title}
                {count != null && (
                  <span className="ml-2 text-sm font-medium text-[var(--av2-text-2)] tabular-nums">
                    {count}
                  </span>
                )}
              </h3>
            )}
            {description && (
              <p className="mt-0.5 text-sm text-[var(--av2-text-2)]">{description}</p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

/** Repeated item (step, feature, column…) with a label and row actions. */
export function RepeaterItem({
  label,
  actions,
  children,
}: {
  label: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--av2-border)] bg-[var(--av2-bg)] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">{label}</span>
        {actions}
      </div>
      {children}
    </div>
  );
}

/** Required-field marker for Field labels. */
export function Req() {
  return (
    <span className="text-[var(--av2-link)]" aria-hidden>
      {" "}
      *
    </span>
  );
}

/** Inline code chip used in hints. */
export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-[var(--av2-track)] px-1 py-0.5 font-mono text-xs text-[var(--av2-text)]">
      {children}
    </code>
  );
}

// ---------------------------------------------------------------------------
// Icon buttons
// ---------------------------------------------------------------------------

const svgBase = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function IconArrowUp(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgBase} {...p}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  );
}
export function IconArrowDown(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgBase} {...p}>
      <path d="M12 5v14M6 13l6 6 6-6" />
    </svg>
  );
}
export function IconArrowLeft(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgBase} {...p}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}
export function IconArrowRight(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgBase} {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
export function IconTrash(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgBase} {...p}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </svg>
  );
}
export function IconPlus(p: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgBase} {...p}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** 32px square icon-only button. Always pass an aria-label. */
export function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-35",
        danger
          ? "text-[var(--av2-text-2)] hover:bg-[#fde3e1] hover:text-[var(--av2-error-text)] disabled:hover:bg-transparent disabled:hover:text-[var(--av2-text-2)] dark:hover:bg-[#3a1715]"
          : "text-[var(--av2-text-2)] hover:bg-[var(--av2-track)] hover:text-[var(--av2-text)] disabled:hover:bg-transparent disabled:hover:text-[var(--av2-text-2)]",
        "focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:ring-offset-1 focus-visible:outline-none",
      )}
    >
      {children}
    </button>
  );
}

/** Up / down / remove cluster for a repeated row. */
export function ReorderActions({
  noun,
  index,
  count,
  onMove,
  onRemove,
  removeDisabled,
  horizontal = false,
}: {
  /** e.g. "step 2" — used in aria-labels. */
  noun: string;
  index: number;
  count: number;
  onMove?: (direction: -1 | 1) => void;
  onRemove?: () => void;
  removeDisabled?: boolean;
  /** Left / right arrows instead of up / down (footer columns). */
  horizontal?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {onMove && (
        <>
          <IconButton
            label={`Move ${noun} ${horizontal ? "left" : "up"}`}
            onClick={() => onMove(-1)}
            disabled={index === 0}
          >
            {horizontal ? <IconArrowLeft /> : <IconArrowUp />}
          </IconButton>
          <IconButton
            label={`Move ${noun} ${horizontal ? "right" : "down"}`}
            onClick={() => onMove(1)}
            disabled={index === count - 1}
          >
            {horizontal ? <IconArrowRight /> : <IconArrowDown />}
          </IconButton>
        </>
      )}
      {onRemove && (
        <IconButton label={`Remove ${noun}`} onClick={onRemove} disabled={removeDisabled} danger>
          <IconTrash />
        </IconButton>
      )}
    </div>
  );
}

/** Secondary "+ Add …" button for repeaters. */
export function AddButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Button size="sm" onClick={onClick} disabled={disabled}>
      <IconPlus width={16} height={16} />
      {children}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Link list (label + destination rows)
// ---------------------------------------------------------------------------

const LINK_GRID = "grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]";

/** Bordered list of label/destination rows with a column header. */
export function LinkList({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--av2-border)]">
      <div
        aria-hidden
        className={cx(
          LINK_GRID,
          "hidden border-b border-[var(--av2-border)] bg-[var(--av2-bg)] px-3 py-2 text-xs font-medium text-[var(--av2-text-2)] sm:grid",
        )}
      >
        <span>Label</span>
        <span>Destination</span>
        <span className="w-[104px] text-center">Actions</span>
      </div>
      <ul className="divide-y divide-[var(--av2-border)]">{children}</ul>
    </div>
  );
}

export function LinkRow({ children, actions }: { children: ReactNode; actions: ReactNode }) {
  return (
    <li className={cx(LINK_GRID, "items-center px-3 py-2.5")}>
      {children}
      <div className="flex justify-end sm:w-[104px] sm:justify-center">{actions}</div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Save footer
// ---------------------------------------------------------------------------

/** Error callout + dirty-state SaveBar with the form's submit button. */
export function BlockSaveFooter({
  error,
  dirty,
  submitting,
  label,
}: {
  error: string | null;
  dirty: boolean;
  submitting: boolean;
  label: string;
}) {
  return (
    <div className="mt-8 space-y-4 border-t border-[var(--av2-border)] pt-5">
      {error ? (
        <Callout tone="error" title="Couldn't save">
          {error}
        </Callout>
      ) : null}
      <SaveBar dirty={dirty} status={submitting ? "Saving…" : undefined}>
        <Button type="submit" variant="primary" disabled={submitting || !dirty}>
          {submitting ? "Saving…" : label}
        </Button>
      </SaveBar>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Switchers used by the server pages
// ---------------------------------------------------------------------------

export type SwitcherSection = {
  id: string;
  label: string;
  description?: ReactNode;
  icon?: ReactNode;
  content: ReactNode;
};

/** Reads `#id` from the URL once so a section can be deep-linked. */
function useHashSelection(ids: string[], fallback: string) {
  const [value, setValue] = useState(fallback);
  useEffect(() => {
    const fromHash = window.location.hash.replace(/^#/, "");
     
    if (ids.includes(fromHash)) setValue(fromHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const select = (id: string) => {
    setValue(id);
    try {
      window.history.replaceState(null, "", `#${id}`);
    } catch {
      /* ignore */
    }
  };
  return [value, select] as const;
}

/**
 * Vertical section selector (left) + the selected section's editor (right).
 * Every section stays mounted; the inactive ones are `hidden`.
 */
export function SectionSwitcher({
  sections,
  label,
  footer,
}: {
  sections: SwitcherSection[];
  label: string;
  /** Small note under the selector list. */
  footer?: ReactNode;
}) {
  const prefix = useId();
  const [active, select] = useHashSelection(
    sections.map((s) => s.id),
    sections[0]?.id ?? "",
  );

  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(e.key)) return;
    e.preventDefault();
    const i = sections.findIndex((s) => s.id === active);
    const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : sections.length - 1;
    const next = sections[(i + step) % sections.length];
    select(next.id);
    requestAnimationFrame(() => document.getElementById(`${prefix}-tab-${next.id}`)?.focus());
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <nav className="rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-4 lg:sticky lg:top-24">
        <h2 className="px-2 pt-1 pb-3 text-xl leading-7 font-semibold">Sections</h2>
        <div
          role="tablist"
          aria-label={label}
          aria-orientation="vertical"
          onKeyDown={onKey}
          className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1"
        >
          {sections.map((s) => {
            const selected = s.id === active;
            return (
              <button
                key={s.id}
                id={`${prefix}-tab-${s.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${prefix}-panel-${s.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(s.id)}
                className={cx(
                  "flex h-11 items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition-colors",
                  selected
                    ? "bg-[var(--av2-selected)] text-[var(--av2-link)]"
                    : "text-[var(--av2-text)] hover:bg-[var(--av2-bg)]",
                  "focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none",
                )}
              >
                {s.icon && (
                  <span
                    className={cx(
                      "shrink-0",
                      selected ? "text-[var(--av2-link)]" : "text-[var(--av2-text-2)]",
                    )}
                  >
                    {s.icon}
                  </span>
                )}
                <span className="truncate">{s.label}</span>
              </button>
            );
          })}
        </div>
        {footer && (
          <div className="mt-4 border-t border-[var(--av2-border)] px-2 pt-4 text-sm text-[var(--av2-text-2)]">
            {footer}
          </div>
        )}
      </nav>

      <div className="min-w-0">
        {sections.map((s) => (
          <section
            key={s.id}
            role="tabpanel"
            id={`${prefix}-panel-${s.id}`}
            aria-labelledby={`${prefix}-tab-${s.id}`}
            hidden={s.id !== active}
            className="rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-6"
          >
            <header className="mb-6">
              <h2 className="text-xl leading-7 font-semibold">{s.label}</h2>
              {s.description && (
                <p className="mt-1 max-w-3xl text-sm text-[var(--av2-text-2)]">{s.description}</p>
              )}
            </header>
            {s.content}
          </section>
        ))}
      </div>
    </div>
  );
}

/** Underlined tabs over a single card; every panel stays mounted. */
export function TabbedPanels({ sections, label }: { sections: SwitcherSection[]; label: string }) {
  const prefix = useId();
  const [active, select] = useHashSelection(
    sections.map((s) => s.id),
    sections[0]?.id ?? "",
  );
  return (
    <div>
      <div className="mb-6">
        <Tabs
          label={label}
          idPrefix={prefix}
          value={active}
          onChange={select}
          tabs={sections.map((s) => ({ value: s.id, label: s.label }))}
        />
      </div>
      {sections.map((s) => (
        <div key={s.id} hidden={s.id !== active}>
          <TabPanel idPrefix={prefix} value={s.id}>
            <section className="rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-6">
              <header className="mb-6">
                <h2 className="text-xl leading-7 font-semibold">{s.label}</h2>
                {s.description && (
                  <p className="mt-1 max-w-3xl text-sm text-[var(--av2-text-2)]">{s.description}</p>
                )}
              </header>
              {s.content}
            </section>
          </TabPanel>
        </div>
      ))}
    </div>
  );
}
