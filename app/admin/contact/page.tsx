// -----------------------------------------------------------------------------
// @file: app/admin/contact/page.tsx
// @purpose: Admin inbox for public /contact form messages. Inbox-style list
//           (filterable by New / Read / Archived + local search) on the left,
//           a reading pane for the selected message on the right with
//           Reply by email, Mark read/unread, Archive and owner-only Delete.
//           Opening a message never changes its status; only the explicit
//           pane actions do.
//
//           Read-mostly by design: the submission side is the public
//           contact form; admins only triage here.
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-11-01
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";
import { useSessionRole } from "@/lib/hooks/use-session-role";
import {
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  DetailPanel,
  EmptyState,
  FilterChips,
  PageHeader,
  PanelSection,
  SearchInput,
  Skeleton,
  SplitView,
  fmt,
  plural,
  type Tone,
} from "@/components/admin/v2/ui";

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

const STATUS_TONE: Record<ContactStatus, Tone> = {
  NEW: "peach",
  READ: "neutral",
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

/** Compact list timestamp: time today, "3 Oct" this year, else with year. */
function formatShort(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(d);
    }
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
    }).format(d);
  } catch {
    return iso;
  }
}

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

const IconMail = ({ size = 18 }: { size?: number }) => (
  <svg {...glyph} width={size} height={size}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m4 7 8 6 8-6" />
  </svg>
);
const IconMailOpen = () => (
  <svg {...glyph}>
    <path d="M3 10v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9l-9-6z" />
    <path d="m4 11 8 5 8-5" />
  </svg>
);
const IconArchive = () => (
  <svg {...glyph}>
    <rect x="3" y="4" width="18" height="5" rx="1" />
    <path d="M5 9v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4" />
  </svg>
);
const IconRefresh = () => (
  <svg {...glyph}>
    <path d="M20 11a8 8 0 0 0-14.9-3.5M4 4v4h4" />
    <path d="M4 13a8 8 0 0 0 14.9 3.5M20 20v-4h-4" />
  </svg>
);

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
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      setLoaded(true);
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
      setBusyId(id);
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
      } finally {
        setBusyId(null);
      }
    },
    [load, showToast],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setDeleting(true);
      try {
        const res = await fetch(`/api/admin/contact/${id}`, { method: "DELETE" });
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) {
          showToast({ type: "error", title: body?.error ?? "Couldn't delete." });
          return;
        }
        showToast({ type: "success", title: "Message deleted." });
        setItems((prev) => prev.filter((row) => row.id !== id));
        setSelectedId((cur) => (cur === id ? null : cur));
      } catch (err) {
        showToast({
          type: "error",
          title: err instanceof Error ? err.message : "Couldn't delete.",
        });
      } finally {
        setDeleting(false);
        setDeleteId(null);
      }
    },
    [showToast],
  );

  const totalAll = Object.values(counts).reduce((a, b) => a + b, 0);

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((row) =>
      [row.name, row.email, row.company, row.topic, row.message]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q)),
    );
  }, [items, query]);

  const selected = items.find((row) => row.id === selectedId) ?? null;
  const filtered = statusFilter !== "ALL" || query.trim() !== "";

  const reply = (row: ContactRow) => {
    window.location.href = `mailto:${row.email}?subject=${encodeURIComponent("Re: your message to brandbite")}`;
  };

  // ---------------------------------------------------------------------------
  // Reading pane
  // ---------------------------------------------------------------------------

  const busy = selected ? busyId === selected.id : false;

  const panel = selected ? (
    <DetailPanel
      title={
        <span className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 break-words">{selected.topic || "Contact message"}</span>
          <Badge tone={STATUS_TONE[selected.status]} dot={selected.status === "NEW"}>
            {STATUS_LABEL[selected.status]}
          </Badge>
        </span>
      }
      onClose={() => setSelectedId(null)}
      closeLabel="Close message"
    >
      <PanelSection>
        <div className="flex items-center gap-3">
          <Avatar name={selected.name} size={44} />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{selected.name}</p>
            <a
              href={`mailto:${selected.email}`}
              className="block truncate text-sm text-[var(--av2-link)] hover:underline"
            >
              {selected.email}
            </a>
          </div>
        </div>
        <p className="mt-3 text-sm text-[var(--av2-text-2)]">
          {formatDateTime(selected.createdAt)}
          {selected.company && <> · {selected.company}</>}
        </p>
      </PanelSection>

      <PanelSection>
        <p className="text-base leading-7 break-words whitespace-pre-wrap">{selected.message}</p>
      </PanelSection>

      <PanelSection>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => reply(selected)}>
            <IconMail />
            Reply by email
          </Button>
          {selected.status !== "READ" && (
            <Button onClick={() => void handleStatusChange(selected.id, "READ")} disabled={busy}>
              <IconMailOpen />
              Mark as read
            </Button>
          )}
          {selected.status !== "NEW" && (
            <Button onClick={() => void handleStatusChange(selected.id, "NEW")} disabled={busy}>
              <IconMail />
              Mark as unread
            </Button>
          )}
          {selected.status !== "ARCHIVED" && (
            <Button
              onClick={() => void handleStatusChange(selected.id, "ARCHIVED")}
              disabled={busy}
            >
              <IconArchive />
              Archive
            </Button>
          )}
        </div>
        <p className="mt-3 text-sm text-[var(--av2-text-2)]">
          Reply opens your email app. Mark the message as read once it&apos;s handled; archiving
          keeps it available under Archived.
        </p>
      </PanelSection>

      {isSiteOwner && (
        <PanelSection title="Danger zone">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="min-w-0 flex-1 text-sm text-[var(--av2-text-2)]">
              Delete spam permanently. Real messages should be archived instead.
            </p>
            <Button variant="danger" size="sm" onClick={() => setDeleteId(selected.id)}>
              Delete message
            </Button>
          </div>
        </PanelSection>
      )}
    </DetailPanel>
  ) : null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <PageHeader
        title="Contact inbox"
        description="Messages sent through the public /contact form. Every submission also emails all site owners; this queue is the durable record."
        actions={
          <Button onClick={() => void load()} disabled={loading}>
            <IconRefresh />
            Refresh
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterChips
          label="Filter by status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "ALL", label: "All", count: loaded ? totalAll : null },
            ...ALL_STATUSES.map((s) => ({
              value: s,
              label: STATUS_LABEL[s],
              count: loaded ? counts[s] : null,
            })),
          ]}
        />
        <SearchInput
          className="w-full sm:w-80"
          value={query}
          onChange={setQuery}
          placeholder="Search sender, topic or message"
          label="Search messages by sender, company, topic or message"
        />
      </div>

      {error && (
        <div className="mb-6">
          <Callout
            tone="error"
            title="Couldn't load messages"
            action={
              <Button size="sm" onClick={() => void load()}>
                Try again
              </Button>
            }
          >
            {error}
          </Callout>
        </div>
      )}

      <SplitView panel={panel}>
        <Card padding="none">
          {loading && !loaded ? (
            <div className="space-y-3 px-6 py-5" role="status">
              <span className="sr-only">Loading messages…</span>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : !loaded ? (
            <EmptyState
              icon={<IconMail size={28} />}
              title="Inbox unavailable"
              description="Messages couldn't be loaded. Try again in a moment."
            />
          ) : totalAll === 0 ? (
            <EmptyState
              icon={<IconMail size={28} />}
              title="No messages yet"
              description="When visitors send a message via the contact form, it'll show up here."
            />
          ) : visibleItems.length === 0 ? (
            <EmptyState
              title={
                statusFilter === "NEW" && !query.trim()
                  ? "No new messages"
                  : "Nothing matches these filters"
              }
              description={
                statusFilter === "NEW" && !query.trim()
                  ? "You're all caught up. Read and archived messages are under their own filters."
                  : "Try a different status or search."
              }
              action={
                filtered ? (
                  <Button
                    onClick={() => {
                      setStatusFilter("ALL");
                      setQuery("");
                    }}
                  >
                    Show all messages
                  </Button>
                ) : null
              }
            />
          ) : (
            <>
              <ul
                aria-label="Contact messages"
                aria-busy={loading}
                className={loading ? "opacity-60" : undefined}
              >
                {visibleItems.map((row) => {
                  const active = row.id === selectedId;
                  const unread = row.status === "NEW";
                  const preview = row.message.replace(/\s+/g, " ").trim();
                  return (
                    <li
                      key={row.id}
                      className="border-b border-[var(--av2-border)] last:border-b-0"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedId(row.id)}
                        aria-current={active ? "true" : undefined}
                        aria-label={`${unread ? "Unread. " : ""}${row.name}: ${row.topic || preview.slice(0, 60)}`}
                        className={`flex w-full gap-3 px-6 py-4 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--av2-accent)] ${
                          active
                            ? "bg-[var(--av2-selected)] shadow-[inset_3px_0_0_var(--av2-accent)]"
                            : "hover:bg-[var(--av2-bg)]"
                        }`}
                      >
                        <span className="relative shrink-0">
                          <Avatar
                            name={row.name}
                            size={40}
                            tone={unread ? "lavender" : "neutral"}
                          />
                          {unread && (
                            <span
                              aria-hidden
                              className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--av2-surface)] bg-[var(--av2-accent)]"
                            />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-2">
                            <span
                              className={`min-w-0 flex-1 truncate text-base ${unread ? "font-bold" : "font-semibold"}`}
                            >
                              {row.name}
                            </span>
                            <span className="shrink-0 text-xs text-[var(--av2-text-2)] tabular-nums">
                              {formatShort(row.createdAt)}
                            </span>
                          </span>
                          <span className="block truncate text-sm text-[var(--av2-text-2)]">
                            {row.email}
                            {row.company && <> · {row.company}</>}
                          </span>
                          <span
                            className={`mt-1.5 block truncate text-sm ${unread ? "font-semibold" : "font-medium"}`}
                          >
                            {row.topic || preview}
                          </span>
                          {row.topic && (
                            <span className="block truncate text-sm text-[var(--av2-text-2)]">
                              {preview}
                            </span>
                          )}
                          <span className="mt-2 block">
                            <Badge tone={STATUS_TONE[row.status]} dot={unread}>
                              {STATUS_LABEL[row.status]}
                            </Badge>
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="border-t border-[var(--av2-border)] px-6 py-4 text-sm text-[var(--av2-text-2)]">
                Showing {fmt(visibleItems.length)} of {fmt(items.length)}{" "}
                {plural(items.length, "message", "messages")}
                {statusFilter !== "ALL" && ` · ${STATUS_LABEL[statusFilter]}`}
              </div>
            </>
          )}
        </Card>
      </SplitView>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && void handleDelete(deleteId)}
        title="Delete this message?"
        description="This cannot be undone."
        confirmLabel="Delete"
        loading={deleting}
      />
    </>
  );
}
