// -----------------------------------------------------------------------------
// @file: components/dashboard/tickets/shared.tsx
// @purpose: Pieces shared by the customer and creative ticket screens: list
//           helpers, the detail header, version cards and the comment thread.
//           Everything reads the --av2-* tokens, so it follows light and dark.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useId, useState, type ReactNode, type SVGProps } from "react";

import { IconChevronDown } from "@/components/admin/v2/icons";
import {
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  DASH,
  EmptyState,
  Field,
  PRIORITY,
  SegmentedControl,
  Skeleton,
  TextArea,
  TICKET_STATUS,
  type Tone,
} from "@/components/admin/v2/ui";
import { RevisionImageGrid, type AssetEntry } from "@/components/ui/revision-image";
import { formatBoardDate, formatDateTime, isDueDateOverdue, isDueDateSoon } from "@/lib/board";
import { downloadAssetsAsZip, downloadSingleAsset } from "@/lib/download-helpers";

const FOCUS =
  "focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:ring-offset-1 focus-visible:outline-none";

// ---------------------------------------------------------------------------
// Glyphs the admin icon set doesn't carry
// ---------------------------------------------------------------------------

type IconProps = SVGProps<SVGSVGElement>;

const glyph = {
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

export function IconDownload(p: IconProps) {
  return (
    <svg {...glyph} {...p}>
      <path d="M12 4v11M7.5 11 12 15.5 16.5 11M5 20h14" />
    </svg>
  );
}

export function IconArrowLeft(p: IconProps) {
  return (
    <svg {...glyph} {...p}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

export function IconCheck(p: IconProps) {
  return (
    <svg {...glyph} {...p}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function IconCompare(p: IconProps) {
  return (
    <svg {...glyph} {...p}>
      <path d="M4 8h14M14.5 4.5 18 8l-3.5 3.5M20 16H6M9.5 12.5 6 16l3.5 3.5" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

/** Kanban / List switch. Board pages keep their own control. */
export function TicketViewToggle({ rolePath }: { rolePath: "/customer" | "/creative" }) {
  return (
    <SegmentedControl
      label="Board view"
      value="list"
      options={[
        { value: "kanban", label: "Kanban", href: `${rolePath}/board` },
        { value: "list", label: "List", href: `${rolePath}/tickets` },
      ]}
    />
  );
}

export function SortableTh({
  label,
  direction,
  onSort,
  className = "",
}: {
  label: string;
  direction: "asc" | "desc" | null;
  onSort: () => void;
  className?: string;
}) {
  return (
    <th
      scope="col"
      aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}
      className={`border-b border-[var(--av2-border)] px-4 py-3 first:pl-6 last:pr-6 ${className}`}
    >
      <button
        type="button"
        onClick={onSort}
        className={`flex items-center gap-1 rounded text-xs font-medium tracking-[0.08em] whitespace-nowrap text-[var(--av2-text-2)] uppercase hover:text-[var(--av2-text)] ${FOCUS}`}
      >
        {label}
        <IconChevronDown
          width={14}
          height={14}
          className={`transition-transform ${direction ? "text-[var(--av2-text)]" : "opacity-40"} ${
            direction === "asc" ? "rotate-180" : ""
          }`}
        />
      </button>
    </th>
  );
}

/** "1 token", "3 tokens". */
export const tokenCount = (n: number) => `${n.toLocaleString()} ${n === 1 ? "token" : "tokens"}`;

/** A due date, or a dash. Finished work is never flagged as late. */
export function DueDate({ iso, done = false }: { iso: string | null; done?: boolean }) {
  if (!iso) return <span className="text-[var(--av2-text-2)]">{DASH}</span>;
  const overdue = !done && isDueDateOverdue(iso);
  const soon = !done && !overdue && isDueDateSoon(iso);
  return (
    <span
      className={
        overdue ? "font-medium text-[var(--av2-error-text)]" : soon ? "font-semibold" : undefined
      }
    >
      {formatBoardDate(iso)}
      {overdue ? " · Overdue" : soon ? " · Due soon" : ""}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const meta = TICKET_STATUS[status];
  if (!meta) return <Badge>{status}</Badge>;
  return (
    <Badge tone={meta.tone as Tone} dot>
      {meta.label}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const meta = PRIORITY[priority];
  if (!meta) return <Badge>{priority}</Badge>;
  return <Badge tone={meta.tone as Tone}>{meta.label}</Badge>;
}

// ---------------------------------------------------------------------------
// Detail scaffolding
// ---------------------------------------------------------------------------

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`mb-3 inline-flex min-h-10 items-center gap-2 rounded text-sm font-medium text-[var(--av2-text-2)] hover:text-[var(--av2-text)] ${FOCUS}`}
    >
      <IconArrowLeft />
      {children}
    </Link>
  );
}

export function TicketHeader({
  code,
  title,
  meta,
  badges,
  actions,
}: {
  code?: string | null;
  title: ReactNode;
  meta?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1 basis-80">
        {code ? (
          <p className="text-sm font-medium tracking-[0.08em] text-[var(--av2-text-2)]">{code}</p>
        ) : null}
        <div className="mt-1">{title}</div>
        {meta ? <div className="mt-1 text-sm text-[var(--av2-text-2)]">{meta}</div> : null}
        {badges ? <div className="mt-3 flex flex-wrap items-center gap-2">{badges}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function TicketTitle({ children }: { children: ReactNode }) {
  return <h1 className="text-[32px] leading-10 font-bold tracking-tight">{children}</h1>;
}

export function DetailSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-label={label}>
      <Skeleton className="mb-3 h-5 w-32" />
      <Skeleton className="mb-3 h-10 w-2/3" />
      <Skeleton className="mb-6 h-6 w-48" />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
        <div className="space-y-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

/** Main column and details rail of the two detail screens. */
export function DetailColumns({ children, rail }: { children: ReactNode; rail: ReactNode }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
      <div className="min-w-0 space-y-6">{children}</div>
      <aside className="min-w-0 space-y-6">{rail}</aside>
    </div>
  );
}

export function PersonRow({
  name,
  role,
  assigned,
}: {
  name: string;
  role: string;
  /** Set for the "creative team" row, whose person isn't shown to customers. */
  assigned?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {assigned === undefined ? (
        <Avatar name={name} size={40} />
      ) : (
        <span
          aria-hidden
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            assigned
              ? "bg-[var(--av2-success-bg)] text-[var(--av2-text)]"
              : "bg-[var(--av2-track)] text-[var(--av2-text-2)]"
          }`}
        >
          {assigned ? <IconCheck /> : DASH}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="text-sm text-[var(--av2-text-2)]">{role}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

/**
 * RevisionImageGrid is shared with the boards and is sized for small
 * thumbnails there. These overrides give it the compact two-up preview of the
 * detail screens (and readable, reachable overlays) without changing the
 * boards. They target the grid only, never the lightbox it renders next to it.
 */
const PREVIEW_OVERRIDES = [
  "[&>.grid]:mt-0 [&>.grid]:gap-3 [&>.grid]:grid-cols-1 sm:[&>.grid]:grid-cols-2",
  "[&>.grid_img]:h-44 [&>.grid_img]:w-full [&>.grid_img]:object-contain",
  "[&>.grid_button.h-16]:!h-44 [&>.grid_button.h-16_span]:!text-xs",
  "[&>.grid_button[aria-label=Download]]:!h-10 [&>.grid_button[aria-label=Download]]:!w-10",
  "[&>.grid_button[aria-label=Download]]:!bg-black/60 [&>.grid_button[aria-label=Download]]:!text-white",
  "[&>.grid_button[aria-label=Download]_svg]:!h-[18px] [&>.grid_button[aria-label=Download]_svg]:!w-[18px]",
  "[&>.grid_div.top-1]:!h-6 [&>.grid_div.top-1]:!text-xs",
].join(" ");

export function FilePreviews({
  assets,
  pinMode = "view",
  ticketId,
  onRevisionSubmitted,
}: {
  assets: AssetEntry[];
  pinMode?: "review" | "view" | "resolve";
  ticketId?: string;
  onRevisionSubmitted?: () => void;
}) {
  if (assets.length === 0) return null;
  return (
    <div>
      <div className={PREVIEW_OVERRIDES}>
        <RevisionImageGrid
          assets={assets}
          pinMode={pinMode}
          ticketId={ticketId}
          onRevisionSubmitted={onRevisionSubmitted}
        />
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--av2-text-2)]">
        {assets.map((asset, i) => (
          <li key={asset.id} className="max-w-full truncate">
            {asset.originalName || `File ${i + 1}`}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One file downloads directly; several go into a zip. */
export function DownloadFilesButton({
  assets,
  zipFilename,
  variant = "secondary",
}: {
  assets: AssetEntry[];
  zipFilename: string;
  variant?: "secondary" | "ghost";
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (assets.length === 0) return null;

  const download = async () => {
    setBusy(true);
    setFailed(false);
    try {
      if (assets.length === 1) {
        await downloadSingleAsset(assets[0].id, assets[0].originalName || "file");
      } else {
        await downloadAssetsAsZip(assets, zipFilename);
      }
    } catch (err) {
      console.error("[DownloadFilesButton] download error", err);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      {failed ? (
        <span role="alert" className="text-xs text-[var(--av2-error-text)]">
          Download failed
        </span>
      ) : null}
      <Button variant={variant} onClick={download} disabled={busy}>
        <IconDownload />
        {busy ? "Preparing…" : assets.length === 1 ? "Download" : `Download all (${assets.length})`}
      </Button>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

export type VersionAsset = AssetEntry & {
  bytes?: number;
  openPins?: number;
  resolvedPins?: number;
};

export type TicketVersion = {
  version: number;
  submittedAt: string | null;
  feedbackAt: string | null;
  feedbackMessage: string | null;
  creativeMessage?: string | null;
  assets: VersionAsset[];
};

export function versionAssets(version: TicketVersion): AssetEntry[] {
  return version.assets.map((a) => ({
    id: a.id,
    url: a.url,
    originalName: a.originalName,
    pinCount: a.pinCount,
  }));
}

function VersionFacts({
  version,
  showDate = true,
}: {
  version: TicketVersion;
  showDate?: boolean;
}) {
  const open = version.assets.reduce((sum, a) => sum + (a.openPins ?? 0), 0);
  const resolved = version.assets.reduce((sum, a) => sum + (a.resolvedPins ?? 0), 0);
  const count = version.assets.length;
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--av2-text-2)]">
      {showDate && version.submittedAt ? <span>{formatBoardDate(version.submittedAt)}</span> : null}
      <span>
        {count} {count === 1 ? "file" : "files"}
      </span>
      {open > 0 ? (
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-2 rounded-full bg-[var(--av2-fill-orange)]" />
          {open} open
        </span>
      ) : null}
      {resolved > 0 ? (
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-2 rounded-full bg-[var(--av2-fill-green)]" />
          {resolved} resolved
        </span>
      ) : null}
    </span>
  );
}

/** Revision feedback. Kept apart from the general comment thread. */
export function FeedbackNote({
  label,
  message,
  at,
}: {
  label: string;
  message: string;
  at: string | null;
}) {
  return (
    <div className="rounded-xl border border-[var(--av2-attention-border)] bg-[var(--av2-attention-from)] p-4">
      <p className="text-xs font-semibold tracking-[0.08em] text-[var(--av2-text)] uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm whitespace-pre-wrap">{message}</p>
      {at ? <p className="mt-1 text-xs text-[var(--av2-text-2)]">{formatBoardDate(at)}</p> : null}
    </div>
  );
}

export type VersionCopy = {
  feedbackLabel: string;
  noteLabel?: string;
  /** Sentence under the heading, e.g. "You sent this version for review on…". */
  sentLine?: (version: TicketVersion) => ReactNode;
};

function VersionBody({
  version,
  pinMode,
  ticketId,
  onRevisionSubmitted,
  copy,
}: {
  version: TicketVersion;
  pinMode: "review" | "view" | "resolve";
  ticketId: string;
  onRevisionSubmitted?: () => void;
  copy: VersionCopy;
}) {
  return (
    <div className="space-y-4">
      {version.creativeMessage ? (
        <p className="text-sm">
          <span className="font-semibold">{copy.noteLabel ?? "Note"}:</span>{" "}
          <span className="whitespace-pre-wrap">{version.creativeMessage}</span>
        </p>
      ) : null}
      {version.assets.length > 0 ? (
        <FilePreviews
          assets={versionAssets(version)}
          pinMode={pinMode}
          ticketId={ticketId}
          onRevisionSubmitted={onRevisionSubmitted}
        />
      ) : (
        <p className="text-sm text-[var(--av2-text-2)]">No files were attached to this version.</p>
      )}
    </div>
  );
}

/** The version on the table, shown open. */
export function CurrentVersionCard({
  version,
  pinMode,
  ticketId,
  zipFilename,
  onRevisionSubmitted,
  copy,
  children,
}: {
  version: TicketVersion;
  pinMode: "review" | "view" | "resolve";
  ticketId: string;
  zipFilename: string;
  onRevisionSubmitted?: () => void;
  copy: VersionCopy;
  children?: ReactNode;
}) {
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-xl leading-7 font-semibold">
            Version {version.version}
            <Badge tone="peach">Current</Badge>
          </h2>
          <div className="mt-1">
            {copy.sentLine ? (
              <p className="text-sm text-[var(--av2-text-2)]">{copy.sentLine(version)}</p>
            ) : null}
            <VersionFacts version={version} showDate={!copy.sentLine} />
          </div>
        </div>
        <DownloadFilesButton assets={versionAssets(version)} zipFilename={zipFilename} />
      </div>
      <VersionBody
        version={version}
        pinMode={pinMode}
        ticketId={ticketId}
        onRevisionSubmitted={onRevisionSubmitted}
        copy={copy}
      />
      {version.feedbackMessage ? (
        <div className="mt-4">
          <FeedbackNote
            label={copy.feedbackLabel}
            message={version.feedbackMessage}
            at={version.feedbackAt}
          />
        </div>
      ) : null}
      {children}
    </Card>
  );
}

/** A version folded to one row. Its feedback stays readable while closed. */
export function CollapsedVersion({
  version,
  isCurrent = false,
  pinMode,
  ticketId,
  zipFilename,
  onRevisionSubmitted,
  copy,
}: {
  version: TicketVersion;
  isCurrent?: boolean;
  pinMode: "review" | "view" | "resolve";
  ticketId: string;
  zipFilename: string;
  onRevisionSubmitted?: () => void;
  copy: VersionCopy;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="space-y-3">
      <Card padding="none">
        <div className="flex items-stretch">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
            className={`flex min-h-14 min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl px-4 py-3 text-left hover:bg-[var(--av2-bg)] ${FOCUS}`}
          >
            <IconChevronDown
              className={`shrink-0 transition-transform ${open ? "" : "-rotate-90"}`}
            />
            <span className="flex items-center gap-2 text-base font-semibold">
              Version {version.version}
              {isCurrent ? <Badge tone="peach">Current</Badge> : null}
            </span>
            <VersionFacts version={version} />
          </button>
        </div>
        {open ? (
          <div
            id={panelId}
            className="space-y-4 border-t border-[var(--av2-border)] px-4 py-4 sm:px-6"
          >
            {copy.sentLine ? (
              <p className="text-sm text-[var(--av2-text-2)]">{copy.sentLine(version)}</p>
            ) : null}
            <VersionBody
              version={version}
              pinMode={pinMode}
              ticketId={ticketId}
              onRevisionSubmitted={onRevisionSubmitted}
              copy={copy}
            />
            <DownloadFilesButton assets={versionAssets(version)} zipFilename={zipFilename} />
          </div>
        ) : null}
      </Card>
      {version.feedbackMessage ? (
        <FeedbackNote
          label={copy.feedbackLabel}
          message={version.feedbackMessage}
          at={version.feedbackAt}
        />
      ) : null}
    </div>
  );
}

/** Heading row above a list of versions, with the compare entry point. */
export function VersionsHeading({
  title,
  count,
  onCompare,
}: {
  title: string;
  count: number;
  onCompare: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {count >= 2 ? (
        <Button onClick={onCompare}>
          <IconCompare />
          Compare versions
        </Button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export type TicketComment = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string | null; email: string; role: string };
};

export function CommentsPanel({
  comments,
  loading,
  error,
  value,
  onChange,
  onSubmit,
  submitting,
  placeholder,
  visibilityNote,
  emptyDescription,
}: {
  comments: TicketComment[] | null;
  loading: boolean;
  error: string | null;
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  placeholder: string;
  visibilityNote: string;
  emptyDescription: string;
}) {
  const fieldId = useId();
  const list = comments ?? [];
  return (
    <Card>
      <h2 className="text-xl leading-7 font-semibold">Comments</h2>
      <p className="mt-0.5 text-sm text-[var(--av2-text-2)]">
        For general conversation. Revision notes stay with their version.
      </p>

      {error ? (
        <div className="mt-4">
          <Callout tone="error" title="Comments could not be updated">
            {error}
          </Callout>
        </div>
      ) : null}

      {loading ? (
        <div aria-busy="true" aria-label="Loading comments" className="mt-4 space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : list.length === 0 && !error ? (
        <EmptyState title="No comments yet" description={emptyDescription} />
      ) : (
        <ul className="mt-4 space-y-4">
          {list.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar name={c.author.name || c.author.email} size={36} tone="neutral" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                  <span className="font-semibold break-all">{c.author.name || c.author.email}</span>
                  <span className="text-xs text-[var(--av2-text-2)]">
                    {formatDateTime(c.createdAt)}
                  </span>
                </p>
                <p className="mt-1 text-sm break-words whitespace-pre-wrap">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 border-t border-[var(--av2-border)] pt-5">
        <Field label="Add a comment" htmlFor={fieldId} hint={visibilityNote}>
          <TextArea
            id={fieldId}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            placeholder={placeholder}
          />
        </Field>
        <div className="mt-3 flex justify-end">
          <Button variant="primary" disabled={submitting || !value.trim()} onClick={onSubmit}>
            {submitting ? "Sending…" : "Add comment"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
