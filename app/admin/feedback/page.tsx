// -----------------------------------------------------------------------------
// @file: app/admin/feedback/page.tsx
// @purpose: Admin triage surface for user-submitted feedback. Lists every
//           entry filed via the floating widget, filterable by type +
//           status. Each row supports inline status updates and an
//           expandable admin-notes editor for "why we're not doing this"
//           rationale that survives the row's lifetime.
//
//           Intentionally read-mostly. The submission side is the user
//           widget; admins only triage here, not invent new entries.
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormSelect, FormTextarea } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { useToast } from "@/components/ui/toast-provider";
import { useSessionRole } from "@/lib/hooks/use-session-role";

type FeedbackType = "BUG" | "FEATURE" | "PRAISE" | "QUESTION";
type FeedbackStatus = "NEW" | "TRIAGED" | "PLANNED" | "DONE" | "WONT_DO";
type Role = "SITE_OWNER" | "SITE_ADMIN" | "DESIGNER" | "CUSTOMER";

type FeedbackRow = {
  id: string;
  type: FeedbackType;
  status: FeedbackStatus;
  subject: string | null;
  message: string;
  pageUrl: string | null;
  userAgent: string | null;
  viewport: string | null;
  submittedById: string;
  submittedByEmail: string;
  submittedByRole: Role;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

type ListResponse = {
  items: FeedbackRow[];
  counts: Record<FeedbackStatus, number>;
};

const TYPE_LABEL: Record<FeedbackType, string> = {
  BUG: "Bug",
  FEATURE: "Feature",
  PRAISE: "Praise",
  QUESTION: "Question",
};

const TYPE_VARIANT: Record<FeedbackType, "warning" | "primary" | "success" | "info"> = {
  BUG: "warning",
  FEATURE: "primary",
  PRAISE: "success",
  QUESTION: "info",
};

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  NEW: "New",
  TRIAGED: "Triaged",
  PLANNED: "Planned",
  DONE: "Done",
  WONT_DO: "Won't do",
};

const STATUS_VARIANT: Record<
  FeedbackStatus,
  "info" | "primary" | "warning" | "success" | "neutral"
> = {
  NEW: "info",
  TRIAGED: "warning",
  PLANNED: "primary",
  DONE: "success",
  WONT_DO: "neutral",
};

const ALL_STATUSES: FeedbackStatus[] = ["NEW", "TRIAGED", "PLANNED", "DONE", "WONT_DO"];

function formatDateTime(iso: string): string {
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

export default function AdminFeedbackPage() {
  const { showToast } = useToast();
  const { isSiteOwner } = useSessionRole();

  const [items, setItems] = useState<FeedbackRow[]>([]);
  const [counts, setCounts] = useState<Record<FeedbackStatus, number>>({
    NEW: 0,
    TRIAGED: 0,
    PLANNED: 0,
    DONE: 0,
    WONT_DO: 0,
  });
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "ALL">("NEW");
  const [typeFilter, setTypeFilter] = useState<FeedbackType | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Per-row expand/collapse for the admin-notes editor.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (typeFilter !== "ALL") params.set("type", typeFilter);
      const res = await fetch(`/api/admin/feedback?${params}`, { cache: "no-store" });
      const body = (await res.json().catch(() => null)) as
        | (ListResponse & { error?: string })
        | null;
      if (!res.ok || !body) throw new Error(body?.error || `HTTP ${res.status}`);
      setItems(body.items);
      setCounts(body.counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load feedback.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleStatusChange = useCallback(
    async (id: string, next: FeedbackStatus) => {
      try {
        const res = await fetch(`/api/admin/feedback/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        });
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) {
          showToast({ type: "error", title: body?.error ?? "Couldn't update status." });
          return;
        }
        showToast({ type: "success", title: `Status set to ${STATUS_LABEL[next]}` });
        // Refresh — the row may move out of the current filter view.
        void load();
      } catch (err) {
        showToast({
          type: "error",
          title: err instanceof Error ? err.message : "Couldn't update status.",
        });
      }
    },
    [load, showToast],
  );

  const handleSaveNotes = useCallback(
    async (id: string) => {
      setSavingId(id);
      try {
        const res = await fetch(`/api/admin/feedback/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ adminNotes: notesDraft[id] ?? "" }),
        });
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) {
          showToast({ type: "error", title: body?.error ?? "Couldn't save notes." });
          return;
        }
        showToast({ type: "success", title: "Admin notes saved." });
        setItems((prev) =>
          prev.map((row) =>
            row.id === id ? { ...row, adminNotes: notesDraft[id]?.trim() || null } : row,
          ),
        );
      } finally {
        setSavingId(null);
      }
    },
    [notesDraft, showToast],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("Delete this feedback entry? This cannot be undone.")) return;
      try {
        const res = await fetch(`/api/admin/feedback/${id}`, { method: "DELETE" });
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) {
          showToast({ type: "error", title: body?.error ?? "Couldn't delete." });
          return;
        }
        showToast({ type: "success", title: "Feedback deleted." });
        setItems((prev) => prev.filter((row) => row.id !== id));
      } catch (err) {
        showToast({
          type: "error",
          title: err instanceof Error ? err.message : "Couldn't delete.",
        });
      }
    },
    [showToast],
  );

  const totalAll = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="text-xl font-bold text-[var(--bb-secondary)]">Feedback</h1>
        <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
          Bug reports, feature requests, praise, and questions submitted by signed-in users via the
          floating feedback widget. Sort by status to triage; the row stays in the queue until you
          mark it Done or Won&apos;t do.
        </p>
      </header>

      {/* Status chips with live counts. Mirrors the talent-queue pattern. */}
      <nav aria-label="Filter by status" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex flex-nowrap gap-2 sm:flex-wrap">
          {(["ALL", ...ALL_STATUSES] as const).map((key) => {
            const label = key === "ALL" ? "All" : STATUS_LABEL[key];
            const count = key === "ALL" ? totalAll : counts[key];
            const active = statusFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                aria-pressed={active}
                className={[
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                  active
                    ? "border-[var(--bb-secondary)] bg-[var(--bb-secondary)] text-white"
                    : "border-[var(--bb-border)] bg-[var(--bb-bg-card)] text-[var(--bb-text-secondary)] hover:border-[var(--bb-primary)] hover:text-[var(--bb-secondary)]",
                ].join(" ")}
              >
                <span>{label}</span>
                {count > 0 && (
                  <span
                    className={[
                      "inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                      active
                        ? "bg-white/20 text-white"
                        : "bg-[var(--bb-bg-page)] text-[var(--bb-text-secondary)]",
                    ].join(" ")}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Type + reload row */}
      <div className="flex flex-wrap items-center gap-2">
        <FormSelect
          aria-label="Filter by type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as FeedbackType | "ALL")}
          className="max-w-[200px]"
        >
          <option value="ALL">All types</option>
          <option value="BUG">Bugs</option>
          <option value="FEATURE">Feature requests</option>
          <option value="PRAISE">Praise</option>
          <option value="QUESTION">Questions</option>
        </FormSelect>
        <Button variant="ghost" size="sm" onClick={() => void load()}>
          ↻ Refresh
        </Button>
      </div>

      {loading && <LoadingState message="Loading feedback…" />}
      {!loading && error && (
        <InlineAlert variant="error" title="Couldn't load feedback">
          {error}
        </InlineAlert>
      )}
      {!loading && !error && items.length === 0 && (
        <EmptyState
          title="Nothing in this view"
          description="When users send feedback via the floating widget, it'll show up here."
        />
      )}

      {!loading && !error && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((row) => {
            const isExpanded = expanded.has(row.id);
            const draft = notesDraft[row.id] ?? row.adminNotes ?? "";
            const dirty = (row.adminNotes ?? "") !== draft.trim();
            return (
              <li
                key={row.id}
                className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={TYPE_VARIANT[row.type]}>{TYPE_LABEL[row.type]}</Badge>
                      <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                      <span className="text-[11px] text-[var(--bb-text-muted)]">
                        {formatDateTime(row.createdAt)} ·{" "}
                        <Link
                          href={`/admin/users/${row.submittedById}`}
                          className="hover:underline"
                          title="Open submitter profile"
                        >
                          {row.submittedByEmail}
                        </Link>{" "}
                        ({row.submittedByRole})
                      </span>
                    </div>
                    {row.subject && (
                      <p className="mt-2 text-sm font-medium text-[var(--bb-secondary)]">
                        {row.subject}
                      </p>
                    )}
                    <p className="mt-1 text-sm whitespace-pre-wrap text-[var(--bb-text-secondary)]">
                      {row.message}
                    </p>
                    {(row.pageUrl || row.viewport) && (
                      <p className="mt-2 text-[11px] text-[var(--bb-text-muted)]">
                        {row.pageUrl && (
                          <>
                            On <code className="break-all">{row.pageUrl}</code>
                          </>
                        )}
                        {row.pageUrl && row.viewport && " · "}
                        {row.viewport && <>Viewport {row.viewport}</>}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0">
                    <FormSelect
                      aria-label="Update status"
                      value={row.status}
                      onChange={(e) =>
                        void handleStatusChange(row.id, e.target.value as FeedbackStatus)
                      }
                      className="w-[120px]"
                      size="sm"
                    >
                      {ALL_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </FormSelect>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setExpanded((prev) => {
                        const next = new Set(prev);
                        if (next.has(row.id)) {
                          next.delete(row.id);
                        } else {
                          next.add(row.id);
                          if (notesDraft[row.id] === undefined) {
                            setNotesDraft((p) => ({ ...p, [row.id]: row.adminNotes ?? "" }));
                          }
                        }
                        return next;
                      });
                    }}
                    className="font-medium text-[var(--bb-primary)] hover:underline"
                  >
                    {isExpanded ? "Hide notes" : row.adminNotes ? "Edit notes" : "Add notes"}
                  </button>
                  {row.adminNotes && !isExpanded && (
                    <span className="truncate text-[var(--bb-text-muted)]">
                      —{" "}
                      {row.adminNotes.length > 80
                        ? `${row.adminNotes.slice(0, 80)}…`
                        : row.adminNotes}
                    </span>
                  )}
                  {isSiteOwner && (
                    <button
                      type="button"
                      onClick={() => void handleDelete(row.id)}
                      className="ml-auto font-medium text-red-600 hover:underline dark:text-red-400"
                    >
                      Delete
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <div className="mt-3 space-y-2">
                    <FormTextarea
                      value={draft}
                      onChange={(e) =>
                        setNotesDraft((prev) => ({ ...prev, [row.id]: e.target.value }))
                      }
                      placeholder="Internal triage notes (never shown to the submitter)"
                      rows={3}
                      maxLength={4000}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setNotesDraft((prev) => ({ ...prev, [row.id]: row.adminNotes ?? "" }))
                        }
                        disabled={!dirty || savingId === row.id}
                      >
                        Reset
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => void handleSaveNotes(row.id)}
                        loading={savingId === row.id}
                        loadingText="Saving…"
                        disabled={!dirty || savingId === row.id}
                      >
                        Save notes
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
