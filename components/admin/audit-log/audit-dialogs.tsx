// -----------------------------------------------------------------------------
// @file: components/admin/audit-log/audit-dialogs.tsx
// @purpose: The audit log's two dialogs: one entry's full record (actor,
//           target, outcome, error, change details, request metadata and
//           IDs) and "About audit log" (what an entry records, and that rows
//           never change). Both are read-only.
// -----------------------------------------------------------------------------

"use client";

import { useId, type ReactNode } from "react";

import { IconClock, IconDocument } from "@/components/admin/v2/icons";
import { Badge, Button, Callout, DASH, IconTile, type Tone } from "@/components/admin/v2/ui";
import { Modal } from "@/components/ui/modal";

import {
  actionLabel,
  formatDay,
  formatTime,
  metadataRows,
  roleLabel,
  targetLabel,
  type AuditEntry,
  type AuditOutcome,
} from "./audit-format";

export const OUTCOME: Record<AuditOutcome, { label: string; tone: Tone }> = {
  SUCCESS: { label: "Success", tone: "green" },
  BLOCKED: { label: "Blocked", tone: "amber" },
  ERROR: { label: "Error", tone: "red" },
};

const glyph = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const IconLock = ({ size = 20 }: { size?: number }) => (
  <svg {...glyph} width={size} height={size}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

export const IconInfo = () => (
  <svg {...glyph}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);

const IconClose = () => (
  <svg {...glyph}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

const IconUser = () => (
  <svg {...glyph}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);

const IconTarget = () => (
  <svg {...glyph}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1" />
  </svg>
);

const IconCheckCircle = () => (
  <svg {...glyph}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12 2.5 2.5 4.5-5" />
  </svg>
);

export function ReadOnlyBadge() {
  return (
    <Badge tone="neutral" icon={<IconLock size={14} />} className="tracking-normal">
      Read-only
    </Badge>
  );
}

export function OutcomeBadge({ outcome }: { outcome: AuditOutcome }) {
  return (
    <Badge tone={OUTCOME[outcome].tone} dot>
      {OUTCOME[outcome].label}
    </Badge>
  );
}

/** Dialog chrome: title + badge + ✕, scrolling body, Close in the footer. */
function DialogFrame({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      labelledBy={titleId}
      className="overflow-hidden border border-[var(--av2-border)] p-0!"
    >
      <div className="flex max-h-[85vh] flex-col bg-[var(--av2-surface)] text-[var(--av2-text)]">
        <header className="flex items-center gap-3 border-b border-[var(--av2-border)] px-6 py-5">
          <h2 id={titleId} className="text-xl leading-7 font-semibold">
            {title}
          </h2>
          <ReadOnlyBadge />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="ml-auto flex h-10 w-10 items-center justify-center rounded-lg text-[var(--av2-text-2)] hover:bg-[var(--av2-bg)] hover:text-[var(--av2-text)] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none"
          >
            <IconClose />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</div>
        <footer className="flex justify-end border-t border-[var(--av2-border)] px-6 py-4">
          <Button onClick={onClose}>Close</Button>
        </footer>
      </div>
    </Modal>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-[var(--av2-text-2)]">{label}</dt>
      <dd className="mt-1 text-base break-words">{children}</dd>
    </div>
  );
}

function Rows({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-[var(--av2-border)]">
      {rows.map((row) => (
        <div key={row.label} className="gap-4 py-3 sm:grid sm:grid-cols-[160px_minmax(0,1fr)]">
          <dt className="text-sm text-[var(--av2-text-2)]">{row.label}</dt>
          <dd className="mt-0.5 min-w-0 text-sm break-words sm:mt-0">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="mb-1 text-lg leading-7 font-semibold">{children}</h3>;
}

const mono = (text: string) => <span className="font-mono text-xs">{text}</span>;

export function AuditEntryDialog({
  entry,
  onClose,
}: {
  entry: AuditEntry | null;
  onClose: () => void;
}) {
  const changes = entry ? metadataRows(entry.metadata) : null;
  return (
    <DialogFrame open={!!entry} onClose={onClose} title="Audit entry">
      {entry && (
        <div className="space-y-8">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-2xl leading-8 font-semibold">{actionLabel(entry.action)}</p>
            <OutcomeBadge outcome={entry.outcome} />
          </div>

          <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            <Fact label="Recorded time">
              {formatDay(entry.createdAt)} · {formatTime(entry.createdAt)}
            </Fact>
            <Fact label="Actor">
              <span className="block font-semibold">{entry.actor.name ?? entry.actor.email}</span>
              <span className="block text-sm text-[var(--av2-text-2)]">
                {roleLabel(entry.actor.role)} at the time
              </span>
              <span className="block text-sm text-[var(--av2-text-2)]">{entry.actor.email}</span>
            </Fact>
            <Fact label="Target type">{entry.target ? targetLabel(entry.target.type) : DASH}</Fact>
            <Fact label="Outcome">
              <OutcomeBadge outcome={entry.outcome} />
            </Fact>
          </dl>

          {entry.errorMessage && (
            <Callout
              tone={entry.outcome === "BLOCKED" ? "warning" : "error"}
              title={entry.outcome === "BLOCKED" ? "Why it was blocked" : "Error message"}
            >
              {entry.errorMessage}
            </Callout>
          )}

          <section className="border-t border-[var(--av2-border)] pt-6">
            <SectionTitle>Change details</SectionTitle>
            {changes ? (
              <Rows
                rows={changes.map((row) => ({
                  label: row.label,
                  value: row.code ? (
                    <pre className="max-h-60 overflow-auto rounded-lg border border-[var(--av2-border)] bg-[var(--av2-bg)] p-3 font-mono text-xs leading-5 whitespace-pre-wrap">
                      {row.value}
                    </pre>
                  ) : (
                    row.value
                  ),
                }))}
              />
            ) : (
              <p className="py-3 text-sm text-[var(--av2-text-2)]">No details recorded.</p>
            )}
          </section>

          <section className="border-t border-[var(--av2-border)] pt-6">
            <SectionTitle>Request metadata</SectionTitle>
            <Rows
              rows={[
                { label: "IP address", value: entry.ipAddress ? mono(entry.ipAddress) : DASH },
                { label: "User agent", value: entry.userAgent ?? DASH },
                ...(entry.target ? [{ label: "Target ID", value: mono(entry.target.id) }] : []),
                { label: "Actor ID", value: mono(entry.actor.id) },
                { label: "Entry ID", value: mono(entry.id) },
              ]}
            />
          </section>
        </div>
      )}
    </DialogFrame>
  );
}

const ENTRY_FIELDS: { icon: ReactNode; tone: Tone; title: string; body: string }[] = [
  { icon: <IconUser />, tone: "lavender", title: "Actor", body: "Who performed the action" },
  {
    icon: <IconDocument />,
    tone: "peach",
    title: "Action",
    body: "What was changed or attempted: payouts, plans, token grants, roles, pricing",
  },
  { icon: <IconTarget />, tone: "green", title: "Target", body: "The affected record" },
  {
    icon: <IconCheckCircle />,
    tone: "lavender",
    title: "Outcome",
    body: "Success, blocked by a permission check, or failed with an error",
  },
  {
    icon: <IconClock />,
    tone: "peach",
    title: "Recorded time",
    body: "When it happened, with the IP address and user agent",
  },
];

export function AboutAuditLogDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <DialogFrame open={open} onClose={onClose} title="About audit log">
      <p className="text-base text-[var(--av2-text-2)]">
        Every privileged admin action is recorded here as it happens, including attempts that were
        blocked. Only site owners can read it.
      </p>
      <h3 className="mt-6 mb-4 text-lg leading-7 font-semibold">What an entry shows</h3>
      <ul className="space-y-4">
        {ENTRY_FIELDS.map((f) => (
          <li key={f.title} className="flex items-start gap-4">
            <IconTile tone={f.tone} size={44} round>
              {f.icon}
            </IconTile>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-semibold">{f.title}</p>
              <p className="text-sm text-[var(--av2-text-2)]">{f.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex items-start gap-4 border-t border-[var(--av2-border)] pt-6">
        <IconTile tone="neutral" size={44} round>
          <IconLock />
        </IconTile>
        <div className="min-w-0 pt-0.5">
          <p className="text-sm font-semibold">Read-only history</p>
          <p className="text-sm text-[var(--av2-text-2)]">
            Rows are append-only. Recorded entries are never edited or deleted, including blocked
            attempts.
          </p>
        </div>
      </div>
    </DialogFrame>
  );
}
