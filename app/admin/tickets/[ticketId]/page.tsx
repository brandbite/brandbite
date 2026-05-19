// -----------------------------------------------------------------------------
// @file: app/admin/tickets/[ticketId]/page.tsx
// @purpose: Per-ticket admin drill-down. Read-only — every mutation still
//           flows through the customer / creative routes so the existing
//           permission posture (only the assigned creative can submit a
//           revision, only the ticket owner can approve, etc.) stays the
//           single source of truth. This page is investigative context.
//
//           Renders:
//             - Header card (title, status, priority, code, customer +
//               creative, deep-links into both user-detail pages)
//             - Brief description + brief attachments
//             - Revision timeline with assets and feedback
//             - Comments timeline
//             - Token cost + payout summary
//             - Assignment history (auto-assign + manual decisions)
//             - Admin actions performed on this ticket
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingState } from "@/components/ui/loading-state";

// ---------------------------------------------------------------------------
// Types — narrow mirrors of the API shape, kept colocated so the page
// compiles without leaking server-only Prisma imports.
// ---------------------------------------------------------------------------

type TicketStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "CANCELED";
type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type Role = "SITE_OWNER" | "SITE_ADMIN" | "DESIGNER" | "CUSTOMER";

type UserRef = { id: string; email: string; name: string | null; role?: Role };

type AssetRow = {
  id: string;
  kind?: string;
  url: string | null;
  mimeType: string;
  bytes: number;
  width: number | null;
  height: number | null;
  originalName: string | null;
  createdAt: string;
};

type RevisionRow = {
  id: string;
  version: number;
  submittedAt: string;
  feedbackAt: string | null;
  creativeMessage: string | null;
  feedbackMessage: string | null;
  submittedByCreative: { id: string; email: string; name: string | null } | null;
  feedbackByCustomer: { id: string; email: string; name: string | null } | null;
  assets: AssetRow[];
};

type CommentRow = {
  id: string;
  body: string;
  createdAt: string;
  author: UserRef;
};

type AssignmentLogRow = {
  id: string;
  creativeId: string | null;
  creative: { email: string; name: string | null } | null;
  reason: string;
  notes: string | null;
  metadata: unknown;
  createdAt: string;
};

type AuditLogRow = {
  id: string;
  action: string;
  outcome: string;
  actorEmail: string;
  actorRole: Role;
  metadata: unknown;
  errorMessage: string | null;
  createdAt: string;
};

type DetailResponse = {
  ticket: {
    id: string;
    code: string;
    title: string;
    description: string | null;
    status: TicketStatus;
    priority: TicketPriority;
    creativeMode: "DESIGNER" | "AI";
    dueDate: string | null;
    quantity: number;
    company: { id: string; name: string; slug: string };
    project: { id: string; name: string; code: string | null } | null;
    createdBy: UserRef;
    creative: UserRef | null;
    completedBy: UserRef | null;
    completedAt: string | null;
    jobType: { id: string; name: string; tokenCost: number } | null;
    tags: { id: string; name: string; color: string }[];
    tokenCostBase: number;
    tokenCostOverride: number | null;
    tokenCostEffective: number;
    creativePayoutOverride: number | null;
    revisionCount: number;
    createdAt: string;
    updatedAt: string;
  };
  briefAssets: AssetRow[];
  revisions: RevisionRow[];
  comments: CommentRow[];
  assignmentLogs: AssignmentLogRow[];
  auditLogs: AuditLogRow[];
};

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

const STATUS_VARIANT: Record<TicketStatus, "info" | "warning" | "primary" | "success"> = {
  TODO: "info",
  IN_PROGRESS: "warning",
  IN_REVIEW: "primary",
  DONE: "success",
  // Cancelled tickets land on this page only via direct deep-link (the
  // admin board hides them). Render as muted info so the operator can
  // still tell at a glance that this row is terminal.
  CANCELED: "info",
};

const PRIORITY_VARIANT: Record<TicketPriority, "neutral" | "info" | "warning" | "primary"> = {
  LOW: "neutral",
  MEDIUM: "info",
  HIGH: "warning",
  URGENT: "primary",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const sec = Math.round(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo} mo ago`;
  return `${Math.round(mo / 12)} yr ago`;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminTicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticketId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/tickets/${ticketId}`, { cache: "no-store" });
        const body = (await res.json().catch(() => null)) as
          | (DetailResponse & { error?: string })
          | null;
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
        if (cancelled) return;
        setData(body as DetailResponse);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load ticket");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  if (loading) return <LoadingState message="Loading ticket…" />;
  if (error)
    return (
      <InlineAlert variant="error" title="Couldn't load ticket">
        {error}
      </InlineAlert>
    );
  if (!data)
    return <EmptyState title="Ticket not found" description="No record matched that id." />;

  const { ticket, briefAssets, revisions, comments, assignmentLogs, auditLogs } = data;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-[var(--bb-text-muted)]">
        <Link href="/admin/tickets" className="hover:text-[var(--bb-secondary)]">
          ← Tickets
        </Link>
        <span>·</span>
        <span>{ticket.code}</span>
      </div>

      {/* Header card */}
      <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded bg-[var(--bb-bg-page)] px-2 py-0.5 text-[11px] font-semibold text-[var(--bb-text-secondary)]">
                {ticket.code}
              </code>
              <Badge variant={STATUS_VARIANT[ticket.status]}>{ticket.status}</Badge>
              <Badge variant={PRIORITY_VARIANT[ticket.priority]}>{ticket.priority}</Badge>
              {ticket.creativeMode === "AI" && <Badge variant="info">AI</Badge>}
              {ticket.tags.map((t) => (
                <span
                  key={t.id}
                  className="inline-block rounded-full border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-2 py-0.5 text-[11px] text-[var(--bb-text-secondary)]"
                >
                  {t.name}
                </span>
              ))}
            </div>
            <h1 className="mt-2 text-xl font-bold text-[var(--bb-secondary)]">{ticket.title}</h1>
            <p className="mt-1 text-xs text-[var(--bb-text-muted)]">
              {ticket.jobType ? <>{ticket.jobType.name} · </> : null}
              Created {formatDateTime(ticket.createdAt)}
              {ticket.dueDate ? <> · Due {formatDateTime(ticket.dueDate)}</> : null}
            </p>
          </div>
        </div>
      </section>

      {/* Customer + creative grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] p-5">
          <h2 className="text-xs font-semibold tracking-wide text-[var(--bb-text-muted)] uppercase">
            Customer
          </h2>
          <p className="mt-2 text-sm font-medium text-[var(--bb-secondary)]">
            <Link
              href={`/admin/companies/${ticket.company.id}`}
              className="hover:text-[var(--bb-primary)] hover:underline"
            >
              {ticket.company.name}
            </Link>
          </p>
          <p className="mt-1 text-xs text-[var(--bb-text-muted)]">
            Created by{" "}
            <Link
              href={`/admin/users/${ticket.createdBy.id}`}
              className="hover:text-[var(--bb-primary)] hover:underline"
            >
              {ticket.createdBy.email}
            </Link>
          </p>
          {ticket.project && (
            <p className="mt-2 text-xs text-[var(--bb-text-muted)]">
              Project: {ticket.project.name}
              {ticket.project.code ? ` (${ticket.project.code})` : ""}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] p-5">
          <h2 className="text-xs font-semibold tracking-wide text-[var(--bb-text-muted)] uppercase">
            Creative
          </h2>
          {ticket.creative ? (
            <>
              <p className="mt-2 text-sm font-medium text-[var(--bb-secondary)]">
                <Link
                  href={`/admin/users/${ticket.creative.id}`}
                  className="hover:text-[var(--bb-primary)] hover:underline"
                >
                  {ticket.creative.name || ticket.creative.email}
                </Link>
              </p>
              <p className="mt-1 text-xs text-[var(--bb-text-muted)]">{ticket.creative.email}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-[var(--bb-text-muted)]">Unassigned</p>
          )}
          {ticket.completedBy && (
            <p className="mt-2 text-xs text-[var(--bb-text-muted)]">
              Approved by {ticket.completedBy.email} · {formatDateTime(ticket.completedAt)}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] p-5">
          <h2 className="text-xs font-semibold tracking-wide text-[var(--bb-text-muted)] uppercase">
            Tokens
          </h2>
          <p className="mt-2 text-sm font-medium text-[var(--bb-secondary)]">
            {ticket.tokenCostEffective.toLocaleString()} tokens
          </p>
          <p className="mt-1 text-xs text-[var(--bb-text-muted)]">
            Base: {ticket.tokenCostBase.toLocaleString()}
            {ticket.quantity > 1 ? ` (×${ticket.quantity})` : ""}
          </p>
          {ticket.tokenCostOverride != null && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              Cost overridden by admin
            </p>
          )}
          {ticket.creativePayoutOverride != null && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              Payout override: {ticket.creativePayoutOverride.toLocaleString()}
            </p>
          )}
        </section>
      </div>

      {/* Brief */}
      <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] p-6">
        <h2 className="text-base font-semibold text-[var(--bb-secondary)]">Brief</h2>
        {ticket.description ? (
          <div
            className="prose prose-sm mt-3 max-w-none text-[var(--bb-text-secondary)]"
            // The description is server-side sanitized at write time
            // (see lib/sanitize.ts in the customer ticket flow); admins
            // are read-only here so re-sanitizing would be overkill.
            dangerouslySetInnerHTML={{ __html: ticket.description }}
          />
        ) : (
          <p className="mt-2 text-xs text-[var(--bb-text-muted)]">No description.</p>
        )}

        {briefAssets.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-medium text-[var(--bb-text-secondary)]">
              Attachments ({briefAssets.length})
            </h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {briefAssets.map((a) => (
                <li
                  key={a.id}
                  className="rounded-lg border border-[var(--bb-border)] bg-[var(--bb-bg-page)] p-2"
                >
                  {a.mimeType.startsWith("image/") && a.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.url}
                      alt={a.originalName ?? ""}
                      className="h-24 w-24 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded bg-[var(--bb-bg-card)] text-[10px] text-[var(--bb-text-muted)]">
                      {a.mimeType.split("/")[1]?.toUpperCase() ?? "FILE"}
                    </div>
                  )}
                  <p className="mt-1 max-w-[96px] truncate text-[10px] text-[var(--bb-text-muted)]">
                    {a.originalName || "(unnamed)"}
                  </p>
                  <p className="text-[10px] text-[var(--bb-text-tertiary)]">
                    {formatBytes(a.bytes)}
                  </p>
                  {a.url && (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[var(--bb-primary)] hover:underline"
                    >
                      Open
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Revisions */}
      <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] p-6">
        <h2 className="mb-3 text-base font-semibold text-[var(--bb-secondary)]">
          Revisions ({revisions.length})
        </h2>
        {revisions.length === 0 ? (
          <p className="text-xs text-[var(--bb-text-muted)]">No revisions submitted yet.</p>
        ) : (
          <ol className="space-y-4">
            {revisions.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-[var(--bb-border-subtle)] bg-[var(--bb-bg-page)] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--bb-secondary)]">
                    v{r.version}
                    {r.submittedByCreative && (
                      <span className="ml-2 text-xs font-normal text-[var(--bb-text-muted)]">
                        by {r.submittedByCreative.email}
                      </span>
                    )}
                  </p>
                  <span className="text-[11px] text-[var(--bb-text-muted)]">
                    Submitted {formatDateTime(r.submittedAt)}
                  </span>
                </div>
                {r.creativeMessage && (
                  <p className="mt-2 text-xs whitespace-pre-wrap text-[var(--bb-text-secondary)]">
                    {r.creativeMessage}
                  </p>
                )}
                {r.assets.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {r.assets.map((a) => (
                      <li
                        key={a.id}
                        className="rounded border border-[var(--bb-border)] bg-[var(--bb-bg-card)] p-2"
                      >
                        {a.mimeType.startsWith("image/") && a.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.url} alt="" className="h-32 w-32 rounded object-cover" />
                        ) : (
                          <div className="flex h-32 w-32 items-center justify-center rounded bg-[var(--bb-bg-page)] text-[10px] text-[var(--bb-text-muted)]">
                            {a.mimeType.split("/")[1]?.toUpperCase() ?? "FILE"}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {r.feedbackAt && (
                  <div className="mt-3 rounded border-l-2 border-[var(--bb-primary)] bg-[var(--bb-bg-card)] px-3 py-2">
                    <p className="text-[11px] text-[var(--bb-text-muted)]">
                      Feedback by {r.feedbackByCustomer?.email ?? "(unknown)"} ·{" "}
                      {formatDateTime(r.feedbackAt)}
                    </p>
                    {r.feedbackMessage && (
                      <p className="mt-1 text-xs whitespace-pre-wrap text-[var(--bb-text-secondary)]">
                        {r.feedbackMessage}
                      </p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Comments */}
      <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] p-6">
        <h2 className="mb-3 text-base font-semibold text-[var(--bb-secondary)]">
          Comments ({comments.length})
        </h2>
        {comments.length === 0 ? (
          <p className="text-xs text-[var(--bb-text-muted)]">No comments yet.</p>
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="border-l-2 border-[var(--bb-border)] pl-3">
                <p className="text-xs font-medium text-[var(--bb-secondary)]">
                  <Link
                    href={`/admin/users/${c.author.id}`}
                    className="hover:text-[var(--bb-primary)] hover:underline"
                  >
                    {c.author.email}
                  </Link>{" "}
                  <span className="font-normal text-[var(--bb-text-muted)]">
                    · {c.author.role ?? ""} · {relativeTime(c.createdAt)}
                  </span>
                </p>
                <p className="mt-1 text-sm whitespace-pre-wrap text-[var(--bb-text-secondary)]">
                  {c.body}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Assignment history */}
      {assignmentLogs.length > 0 && (
        <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] p-6">
          <h2 className="mb-3 text-base font-semibold text-[var(--bb-secondary)]">
            Assignment history
          </h2>
          <ul className="space-y-2 text-xs">
            {assignmentLogs.map((log) => (
              <li
                key={log.id}
                className="flex flex-wrap items-center gap-2 border-b border-[var(--bb-border-subtle)] pb-2 last:border-b-0 last:pb-0"
              >
                <code className="rounded bg-[var(--bb-bg-page)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--bb-text-secondary)]">
                  {log.reason}
                </code>
                {log.creative ? (
                  <span>→ {log.creative.email}</span>
                ) : (
                  <span className="text-[var(--bb-text-muted)]">unassigned</span>
                )}
                <span className="text-[var(--bb-text-muted)]">· {relativeTime(log.createdAt)}</span>
                {log.notes && <span className="text-[var(--bb-text-muted)]">— {log.notes}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Audit log */}
      {auditLogs.length > 0 && (
        <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] p-6">
          <h2 className="mb-3 text-base font-semibold text-[var(--bb-secondary)]">
            Admin actions on this ticket
          </h2>
          <ul className="space-y-2 text-xs">
            {auditLogs.map((log) => (
              <li
                key={log.id}
                className="flex flex-wrap items-center gap-2 border-b border-[var(--bb-border-subtle)] pb-2 last:border-b-0 last:pb-0"
              >
                <Badge variant={log.outcome === "SUCCESS" ? "success" : "neutral"}>
                  {log.outcome}
                </Badge>
                <code className="text-[11px] text-[var(--bb-secondary)]">{log.action}</code>
                <span className="text-[var(--bb-text-muted)]">
                  by {log.actorEmail} ({log.actorRole}) · {relativeTime(log.createdAt)}
                </span>
                {log.errorMessage && (
                  <span className="text-[var(--bb-text-muted)]">— {log.errorMessage}</span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-[var(--bb-text-muted)]">
            <Link
              href={`/admin/audit-log?targetId=${ticket.id}`}
              className="text-[var(--bb-primary)] hover:underline"
            >
              View full audit log for this ticket ↗
            </Link>
          </p>
        </section>
      )}

      <div className="pt-2 text-center">
        <Button variant="secondary" onClick={() => window.history.back()}>
          ← Back
        </Button>
      </div>
    </div>
  );
}
