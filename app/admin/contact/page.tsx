// -----------------------------------------------------------------------------
// @file: app/admin/contact/page.tsx
// @purpose: Admin inbox for public /contact form messages. Flat queue
//           filterable by status (New / Read / Archived) with inline
//           status updates, a reply-by-email shortcut, and owner-only
//           delete for spam. Mirrors the /admin/feedback triage surface.
//
//           Read-mostly by design: the submission side is the public
//           contact form; admins only triage here.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-07-26
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FormSelect } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { useToast } from "@/components/ui/toast-provider";
import { useSessionRole } from "@/lib/hooks/use-session-role";

type ContactStatus = "NEW" | "READ" | "ARCHIVED";

type ContactRow = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  topic: string | null;
  message: string;
  status: ContactStatus;
  createdAt: string;
  updatedAt: string;
};

type ListResponse = {
  items: ContactRow[];
  counts: Record<ContactStatus, number>;
};

const STATUS_LABEL: Record<ContactStatus, string> = {
  NEW: "New",
  READ: "Read",
  ARCHIVED: "Archived",
};

const STATUS_VARIANT: Record<ContactStatus, "info" | "success" | "neutral"> = {
  NEW: "info",
  READ: "success",
  ARCHIVED: "neutral",
};

const ALL_STATUSES: ContactStatus[] = ["NEW", "READ", "ARCHIVED"];

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

export default function AdminContactPage() {
  const { showToast } = useToast();
  const { isSiteOwner } = useSessionRole();

  const [items, setItems] = useState<ContactRow[]>([]);
  const [counts, setCounts] = useState<Record<ContactStatus, number>>({
    NEW: 0,
    READ: 0,
    ARCHIVED: 0,
  });
  const [statusFilter, setStatusFilter] = useState<ContactStatus | "ALL">("NEW");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/contact?${params}`, { cache: "no-store" });
      const body = (await res.json().catch(() => null)) as
        | (ListResponse & { error?: string })
        | null;
      if (!res.ok || !body) throw new Error(body?.error || `HTTP ${res.status}`);
      setItems(body.items);
      setCounts(body.counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contact messages.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleStatusChange = useCallback(
    async (id: string, next: ContactStatus) => {
      try {
        const res = await fetch(`/api/admin/contact/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        });
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) {
          showToast({ type: "error", title: body?.error ?? "Couldn't update status." });
          return;
        }
        showToast({ type: "success", title: `Marked as ${STATUS_LABEL[next]}` });
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

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("Delete this message? This cannot be undone.")) return;
      try {
        const res = await fetch(`/api/admin/contact/${id}`, { method: "DELETE" });
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) {
          showToast({ type: "error", title: body?.error ?? "Couldn't delete." });
          return;
        }
        showToast({ type: "success", title: "Message deleted." });
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
        <h1 className="text-xl font-bold text-[var(--bb-secondary)]">Contact inbox</h1>
        <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
          Messages sent through the public /contact form. Every submission also emails all site
          owners; this queue is the durable record. Mark a message Read once handled, Archive to
          clear it from the default view.
        </p>
      </header>

      {/* Status chips with live counts. Mirrors the feedback-queue pattern. */}
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

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => void load()}>
          ↻ Refresh
        </Button>
      </div>

      {loading && <LoadingState message="Loading messages…" />}
      {!loading && error && (
        <InlineAlert variant="error" title="Couldn't load messages">
          {error}
        </InlineAlert>
      )}
      {!loading && !error && items.length === 0 && (
        <EmptyState
          title="Nothing in this view"
          description="When visitors send a message via the contact form, it'll show up here."
        />
      )}

      {!loading && !error && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((row) => (
            <li
              key={row.id}
              className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                    <span className="text-sm font-medium text-[var(--bb-secondary)]">
                      {row.name}
                    </span>
                    <span className="text-[11px] text-[var(--bb-text-muted)]">
                      {formatDateTime(row.createdAt)} ·{" "}
                      <a href={`mailto:${row.email}`} className="hover:underline">
                        {row.email}
                      </a>
                      {row.company && <> · {row.company}</>}
                    </span>
                  </div>
                  {row.topic && (
                    <p className="mt-2 text-sm font-medium text-[var(--bb-secondary)]">
                      {row.topic}
                    </p>
                  )}
                  <p className="mt-1 text-sm whitespace-pre-wrap text-[var(--bb-text-secondary)]">
                    {row.message}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      window.location.href = `mailto:${row.email}?subject=${encodeURIComponent("Re: your message to Brandbite")}`;
                    }}
                  >
                    Reply
                  </Button>
                  <FormSelect
                    aria-label="Update status"
                    value={row.status}
                    onChange={(e) =>
                      void handleStatusChange(row.id, e.target.value as ContactStatus)
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

              {isSiteOwner && (
                <div className="mt-3 flex justify-end text-[11px]">
                  <button
                    type="button"
                    onClick={() => void handleDelete(row.id)}
                    className="font-medium text-red-600 hover:underline dark:text-red-400"
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
