// -----------------------------------------------------------------------------
// @file: app/admin/feedback/page.tsx
// @purpose: Admin triage surface for user-submitted feedback. Lists every
//           entry filed via the floating widget, filterable by status + type
//           (server) and a local search. Selecting an entry opens a panel
//           with the report itself, its review status and the internal admin
//           notes; status + notes are drafted in the panel and saved together
//           (each through its own PATCH, same payloads as before).
//
//           Intentionally read-mostly. The submission side is the user
//           widget; admins only triage here, not invent new entries.
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-11-01
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";
import { useSessionRole } from "@/lib/hooks/use-session-role";
import {
  Badge,
  Button,
  Callout,
  Card,
  DASH,
  DetailPanel,
  EmptyState,
  Field,
  FilterChips,
  KeyValueList,
  PageHeader,
  PanelSection,
  SaveBar,
  SearchInput,
  Select,
  Skeleton,
  SplitView,
  TabPanel,
  Tabs,
  TextArea,
  fmt,
  plural,
  type Tone,
} from "@/components/admin/v2/ui";

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

const TYPE_TONE: Record<FeedbackType, Tone> = {
  BUG: "red",
  FEATURE: "lavender",
  PRAISE: "green",
  QUESTION: "blue",
};

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  NEW: "New",
  TRIAGED: "Triaged",
  PLANNED: "Planned",
  DONE: "Done",
  WONT_DO: "Won't do",
};

const STATUS_TONE: Record<FeedbackStatus, Tone> = {
  NEW: "peach",
  TRIAGED: "amber",
  PLANNED: "lavender",
  DONE: "green",
  WONT_DO: "neutral",
};

const ALL_STATUSES: FeedbackStatus[] = ["NEW", "TRIAGED", "PLANNED", "DONE", "WONT_DO"];

const ROLE_LABEL: Record<Role, string> = {
  SITE_OWNER: "Site owner",
  SITE_ADMIN: "Site admin",
  DESIGNER: "Creative",
  CUSTOMER: "Customer",
};

type PanelTab = "report" | "notes";

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

const IconRefresh = () => (
  <svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M20 11a8 8 0 0 0-14.9-3.5M4 4v4h4" />
    <path d="M4 13a8 8 0 0 0 14.9 3.5M20 20v-4h-4" />
  </svg>
);

const IconChat = ({ size = 28 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4V6a2 2 0 0 1 1-2z" />
    <path d="M8 9h8M8 13h5" />
  </svg>
);

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
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<PanelTab>("report");
  // Per-entry drafts so switching rows never loses unsaved triage.
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [statusDraft, setStatusDraft] = useState<Record<string, FeedbackStatus>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      setLoaded(true);
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
    async (id: string, next: FeedbackStatus): Promise<boolean> => {
      try {
        const res = await fetch(`/api/admin/feedback/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        });
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) {
          showToast({ type: "error", title: body?.error ?? "Couldn't update status." });
          return false;
        }
        showToast({ type: "success", title: `Status set to ${STATUS_LABEL[next]}` });
        // Refresh — the row may move out of the current filter view.
        void load();
        return true;
      } catch (err) {
        showToast({
          type: "error",
          title: err instanceof Error ? err.message : "Couldn't update status.",
        });
        return false;
      }
    },
    [load, showToast],
  );

  const handleSaveNotes = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/admin/feedback/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ adminNotes: notesDraft[id] ?? "" }),
        });
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) {
          showToast({ type: "error", title: body?.error ?? "Couldn't save notes." });
          return false;
        }
        showToast({ type: "success", title: "Admin notes saved." });
        setItems((prev) =>
          prev.map((row) =>
            row.id === id ? { ...row, adminNotes: notesDraft[id]?.trim() || null } : row,
          ),
        );
        return true;
      } catch (err) {
        showToast({
          type: "error",
          title: err instanceof Error ? err.message : "Couldn't save notes.",
        });
        return false;
      }
    },
    [notesDraft, showToast],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setDeleting(true);
      try {
        const res = await fetch(`/api/admin/feedback/${id}`, { method: "DELETE" });
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) {
          showToast({ type: "error", title: body?.error ?? "Couldn't delete." });
          return;
        }
        showToast({ type: "success", title: "Feedback deleted." });
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
      [row.subject, row.message, row.submittedByEmail, row.pageUrl]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q)),
    );
  }, [items, query]);

  const selected = items.find((row) => row.id === selectedId) ?? null;

  // Draft state for the selected entry
  const notesValue = selected ? (notesDraft[selected.id] ?? selected.adminNotes ?? "") : "";
  const statusValue = selected ? (statusDraft[selected.id] ?? selected.status) : "NEW";
  const notesDirty = selected ? (selected.adminNotes ?? "") !== notesValue.trim() : false;
  const statusDirty = selected ? statusValue !== selected.status : false;
  const dirty = notesDirty || statusDirty;
  const saving = selected ? savingId === selected.id : false;

  const resetDraft = (id: string) => {
    setNotesDraft((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setStatusDraft((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const saveSelected = async () => {
    if (!selected || !dirty) return;
    const id = selected.id;
    setSavingId(id);
    try {
      if (notesDirty) await handleSaveNotes(id);
      if (statusDirty) {
        const ok = await handleStatusChange(id, statusValue);
        if (ok) {
          setStatusDraft((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }
      }
    } finally {
      setSavingId(null);
    }
  };

  const selectRow = (id: string) => {
    setSelectedId(id);
    setPanelTab("report");
  };

  const clearFilters = () => {
    setStatusFilter("ALL");
    setTypeFilter("ALL");
    setQuery("");
  };

  // ---------------------------------------------------------------------------
  // Detail panel
  // ---------------------------------------------------------------------------

  const panel = selected ? (
    <DetailPanel
      title={selected.subject || `${TYPE_LABEL[selected.type]} report`}
      onClose={() => setSelectedId(null)}
      footer={
        <SaveBar
          dirty={dirty}
          status={
            saving
              ? "Saving…"
              : dirty
                ? `Unsaved changes: ${[statusDirty && "status", notesDirty && "notes"].filter(Boolean).join(" and ")}`
                : undefined
          }
        >
          <Button
            variant="ghost"
            onClick={() => resetDraft(selected.id)}
            disabled={!dirty || saving}
          >
            Reset
          </Button>
          <Button variant="primary" onClick={() => void saveSelected()} disabled={!dirty || saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </SaveBar>
      }
    >
      <div className="-mt-1 mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={TYPE_TONE[selected.type]}>{TYPE_LABEL[selected.type]}</Badge>
        <Badge tone={STATUS_TONE[selected.status]} dot>
          {STATUS_LABEL[selected.status]}
        </Badge>
      </div>

      <Tabs
        idPrefix="fb-panel"
        label="Feedback entry"
        value={panelTab}
        onChange={setPanelTab}
        tabs={[
          { value: "report", label: "Report" },
          {
            value: "notes",
            label: (
              <span className="inline-flex items-center gap-1.5">
                Internal notes
                {selected.adminNotes ? (
                  <Badge tone="neutral">Added</Badge>
                ) : notesDirty ? (
                  <Badge tone="amber">Draft</Badge>
                ) : null}
              </span>
            ),
          },
        ]}
      />

      <div className="pt-5" hidden={panelTab !== "report"}>
        <TabPanel idPrefix="fb-panel" value="report">
          <PanelSection title="Message">
            <p className="text-sm whitespace-pre-wrap">{selected.message}</p>
          </PanelSection>

          <PanelSection title="Reported by">
            <KeyValueList
              rows={[
                {
                  label: "Email",
                  value: (
                    <Link
                      href={`/admin/users/${selected.submittedById}`}
                      className="text-[var(--av2-link)] hover:underline"
                      title="Open submitter profile"
                    >
                      {selected.submittedByEmail}
                    </Link>
                  ),
                },
                { label: "Role", value: ROLE_LABEL[selected.submittedByRole] ?? DASH },
                { label: "Submitted", value: formatDateTime(selected.createdAt) },
              ]}
            />
          </PanelSection>

          <PanelSection title="Context">
            <KeyValueList
              rows={[
                {
                  label: "Page",
                  value: selected.pageUrl ? (
                    <code className="text-xs break-all">{selected.pageUrl}</code>
                  ) : (
                    DASH
                  ),
                },
                { label: "Viewport", value: selected.viewport ?? DASH },
                {
                  label: "User agent",
                  value: selected.userAgent ? (
                    <span className="text-xs font-normal">{selected.userAgent}</span>
                  ) : (
                    DASH
                  ),
                },
              ]}
            />
          </PanelSection>

          <PanelSection title="Review status">
            <Field
              label="Status"
              htmlFor="fb-status"
              hint="Done and Won't do close a report. Other statuses keep it in the review queue."
            >
              <Select
                id="fb-status"
                value={statusValue}
                onChange={(e) =>
                  setStatusDraft((prev) => ({
                    ...prev,
                    [selected.id]: e.target.value as FeedbackStatus,
                  }))
                }
                disabled={saving}
              >
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </Field>
          </PanelSection>

          {isSiteOwner && (
            <PanelSection title="Danger zone">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="min-w-0 flex-1 text-sm text-[var(--av2-text-2)]">
                  Delete spam or junk entries permanently.
                </p>
                <Button variant="danger" size="sm" onClick={() => setDeleteId(selected.id)}>
                  Delete entry
                </Button>
              </div>
            </PanelSection>
          )}
        </TabPanel>
      </div>

      <div className="pt-5" hidden={panelTab !== "notes"}>
        <TabPanel idPrefix="fb-panel" value="notes">
          <Field
            label="Internal notes"
            htmlFor="fb-notes"
            hint="Never shown to the submitter. Use it for triage rationale, e.g. why we're not doing this."
          >
            <TextArea
              id="fb-notes"
              value={notesValue}
              onChange={(e) =>
                setNotesDraft((prev) => ({ ...prev, [selected.id]: e.target.value }))
              }
              placeholder="Internal triage notes (never shown to the submitter)"
              rows={8}
              maxLength={4000}
              disabled={saving}
            />
          </Field>
          <p className="mt-2 text-right text-xs text-[var(--av2-text-2)] tabular-nums">
            {fmt(notesValue.length)} / 4,000
          </p>
        </TabPanel>
      </div>
    </DetailPanel>
  ) : null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const filtered = statusFilter !== "ALL" || typeFilter !== "ALL" || query.trim() !== "";

  return (
    <>
      <PageHeader
        title="Feedback"
        description="Reports from the in-app feedback widget. Triage, prioritise and keep internal notes."
        actions={
          <Button onClick={() => void load()} disabled={loading}>
            <IconRefresh />
            Refresh
          </Button>
        }
      />

      <div className="mb-4">
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
      </div>

      {error && (
        <div className="mb-6">
          <Callout
            tone="error"
            title="Couldn't load feedback"
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
          <div className="flex flex-wrap items-center gap-3 px-6 pt-5 pb-4">
            <SearchInput
              className="min-w-[200px] flex-1"
              value={query}
              onChange={setQuery}
              placeholder="Search feedback"
              label="Search feedback by subject, message, email or page"
            />
            <div className="w-full sm:w-44">
              <Select
                aria-label="Filter by type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as FeedbackType | "ALL")}
              >
                <option value="ALL">All types</option>
                <option value="BUG">Bugs</option>
                <option value="FEATURE">Feature requests</option>
                <option value="PRAISE">Praise</option>
                <option value="QUESTION">Questions</option>
              </Select>
            </div>
          </div>

          {loading && !loaded ? (
            <div className="space-y-3 border-t border-[var(--av2-border)] px-6 py-5" role="status">
              <span className="sr-only">Loading feedback…</span>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : !loaded ? (
            <div className="border-t border-[var(--av2-border)]">
              <EmptyState
                icon={<IconChat />}
                title="Feedback unavailable"
                description="The queue couldn't be loaded. Try again in a moment."
              />
            </div>
          ) : totalAll === 0 ? (
            <div className="border-t border-[var(--av2-border)]">
              <EmptyState
                icon={<IconChat />}
                title="No feedback yet"
                description="When signed-in users send feedback via the floating widget, it'll show up here."
              />
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="border-t border-[var(--av2-border)]">
              <EmptyState
                title="Nothing matches these filters"
                description={
                  filtered
                    ? "No entries for this status, type or search. Try a different filter."
                    : "Nothing in this view."
                }
                action={filtered ? <Button onClick={clearFilters}>Show all feedback</Button> : null}
              />
            </div>
          ) : (
            <>
              <ul
                aria-label="Feedback entries"
                aria-busy={loading}
                className={`border-t border-[var(--av2-border)] ${loading ? "opacity-60" : ""}`}
              >
                {visibleItems.map((row) => {
                  const active = row.id === selectedId;
                  return (
                    <li
                      key={row.id}
                      className="border-b border-[var(--av2-border)] last:border-b-0"
                    >
                      <button
                        type="button"
                        onClick={() => selectRow(row.id)}
                        aria-current={active ? "true" : undefined}
                        className={`block w-full px-6 py-4 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--av2-accent)] ${
                          active
                            ? "bg-[var(--av2-selected)] shadow-[inset_3px_0_0_var(--av2-accent)]"
                            : "hover:bg-[var(--av2-bg)]"
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={TYPE_TONE[row.type]}>{TYPE_LABEL[row.type]}</Badge>
                          <Badge tone={STATUS_TONE[row.status]} dot>
                            {STATUS_LABEL[row.status]}
                          </Badge>
                          {row.adminNotes && <Badge tone="neutral">Has notes</Badge>}
                          <span className="ml-auto text-xs whitespace-nowrap text-[var(--av2-text-2)]">
                            {formatDateTime(row.createdAt)}
                          </span>
                        </div>
                        <p className="mt-2 truncate text-base font-semibold">
                          {row.subject || row.message.split("\n")[0]}
                        </p>
                        <p className="mt-0.5 truncate text-sm text-[var(--av2-text-2)]">
                          {row.submittedByEmail} · {ROLE_LABEL[row.submittedByRole] ?? DASH}
                        </p>
                        {row.subject && (
                          <p className="mt-1 line-clamp-2 text-sm text-[var(--av2-text-2)]">
                            {row.message}
                          </p>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="border-t border-[var(--av2-border)] px-6 py-4 text-sm text-[var(--av2-text-2)]">
                Showing {fmt(visibleItems.length)} of {fmt(items.length)}{" "}
                {plural(items.length, "entry", "entries")}
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
        title="Delete this feedback entry?"
        description="This cannot be undone."
        confirmLabel="Delete"
        loading={deleting}
      />
    </>
  );
}
