// -----------------------------------------------------------------------------
// @file: app/admin/board/page.tsx
// @purpose: Admin-facing kanban board over all tickets (read-only, Figma redesign)
// @version: v2.0.0
// @status: active
// @lastUpdate: 2025-12-27
// -----------------------------------------------------------------------------

"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BoardViewToggle } from "@/components/board/board-view-toggle";
import { useToast } from "@/components/ui/toast-provider";
import { InlineAlert } from "@/components/ui/inline-alert";
import { EmptyState } from "@/components/ui/empty-state";
import {
  STATUS_ORDER,
  STATUS_LABELS,
  formatDueDateShort,
  isDueDateOverdue,
  columnAccentColor,
  PROJECT_COLORS,
  avatarColor,
  getInitials,
  priorityIconMap,
  priorityColorClass,
  formatPriorityLabel,
} from "@/lib/board";
import type { TicketStatus } from "@/lib/board";
import { TagBadge } from "@/components/ui/tag-badge";
import type { TagColorKey } from "@/lib/tag-colors";
import { stripHtml } from "@/components/ui/safe-html";
import { buildTicketCode } from "@/lib/ticket-code";

type AdminTicket = {
  id: string;
  title: string;
  /// Sanitized rich-text description. Stripped + truncated client-side
  /// for the card preview; the full body lives at /admin/tickets/[id].
  description: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate: string | null;
  /// Per-company ticket number — used together with project code +
  /// fallback id to build the human-readable ticket code in the card
  /// footer.
  companyTicketNumber: number | null;
  status: TicketStatus;
  createdAt: string;
  company: { id: string; name: string } | null;
  project: { id: string; name: string; code: string | null } | null;
  creative: { id: string; name: string | null; email: string } | null;
  jobType: { id: string; name: string } | null;
  tags: { id: string; name: string; color: string }[];
};

type AdminTicketsResponse = {
  tickets: AdminTicket[];
};

type AdminBoardStats = {
  byStatus: Record<TicketStatus, number>;
  total: number;
  openTotal: number;
};

export default function AdminBoardPage() {
  const { showToast } = useToast();

  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState<string>("");
  const [companyFilter, setCompanyFilter] = useState<string>("ALL");

  // ---------------------------------------------------------------------------
  // Data load
  // ---------------------------------------------------------------------------

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tickets", {
        cache: "no-store",
      });

      const json = (await res.json().catch(() => null)) as
        | AdminTicketsResponse
        | { error?: string }
        | null;

      if (!res.ok) {
        const message =
          json && json && "error" in json && json.error
            ? json.error
            : `Request failed with status ${res.status}`;
        throw new Error(message);
      }

      if (!json || !("tickets" in json)) {
        throw new Error("Unexpected response from server.");
      }

      setTickets(json.tickets);
    } catch (err) {
      console.error("[AdminBoardPage] load error", err);
      const message =
        err instanceof Error ? err.message : "Failed to load tickets. Please try again.";

      setError(message);

      showToast({
        type: "error",
        title: "Could not load admin board",
        description: message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-run auto-assign across currently-unassigned TODO tickets. Useful for
  // tickets created before a company turned auto-assign on. Safe to re-run.
  const [backfilling, setBackfilling] = useState<boolean>(false);
  const runAutoAssignBackfill = async () => {
    setBackfilling(true);
    try {
      const res = await fetch("/api/admin/tickets/auto-assign-backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json().catch(() => null)) as
        | { assigned: number; scanned: number; skipped: number; hasMore: boolean }
        | { error?: string }
        | null;
      if (!res.ok || !json || !("assigned" in json)) {
        const message =
          json && "error" in json && json.error ? json.error : `Failed (${res.status})`;
        throw new Error(message);
      }
      showToast({
        type: "success",
        title: `Assigned ${json.assigned} of ${json.scanned} ticket(s)`,
        description:
          json.skipped > 0
            ? `${json.skipped} skipped (auto-assign off, no eligible creative, or already claimed).${
                json.hasMore ? " More remain — run again." : ""
              }`
            : json.hasMore
              ? "More tickets remain — run again."
              : "All eligible unassigned tickets processed.",
      });
      await load();
    } catch (err) {
      showToast({
        type: "error",
        title: "Auto-assign backfill failed",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setBackfilling(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const stats: AdminBoardStats = useMemo(() => {
    const byStatus: Record<TicketStatus, number> = {
      TODO: 0,
      IN_PROGRESS: 0,
      IN_REVIEW: 0,
      DONE: 0,
      // Cancelled rows are filtered out at the API; only here to
      // satisfy Record<TicketStatus, …>.
      CANCELED: 0,
    };

    for (const t of tickets) {
      byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
    }

    const total = tickets.length;
    const openTotal = total - (byStatus.DONE ?? 0);

    return {
      byStatus,
      total,
      openTotal,
    };
  }, [tickets]);

  const companies = useMemo(() => {
    const set = new Set<string>();
    tickets.forEach((t) => {
      if (t.company?.name) set.add(t.company.name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [tickets]);

  /** Deduped creative list for toolbar avatar circles */
  const uniqueCreatives = useMemo(() => {
    const seen = new Map<string, { name: string | null; email: string }>();
    tickets.forEach((t) => {
      if (t.creative && !seen.has(t.creative.id)) {
        seen.set(t.creative.id, {
          name: t.creative.name,
          email: t.creative.email,
        });
      }
    });
    return Array.from(seen.values());
  }, [tickets]);

  /** Companies with ticket counts for sidebar */
  const companiesWithCounts = useMemo(() => {
    const map = new Map<string, number>();
    tickets.forEach((t) => {
      const name = t.company?.name;
      if (name) map.set(name, (map.get(name) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (companyFilter !== "ALL" && t.company?.name !== companyFilter) {
        return false;
      }

      const q = search.trim().toLowerCase();
      if (q) {
        const haystack = [
          t.title,
          t.company?.name ?? "",
          t.project?.name ?? "",
          t.project?.code ?? "",
          t.creative?.name ?? "",
          t.creative?.email ?? "",
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [tickets, companyFilter, search]);

  const ticketsByStatus = useMemo(() => {
    const map: Record<TicketStatus, AdminTicket[]> = {
      TODO: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      DONE: [],
      // Cancelled rows are filtered out at the API; bucket exists only
      // to satisfy Record<TicketStatus, …>.
      CANCELED: [],
    };

    for (const t of filteredTickets) {
      map[t.status].push(t);
    }

    return map;
  }, [filteredTickets]);

  const activeScopeLabel = companyFilter === "ALL" ? "All companies" : companyFilter;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <div className="mt-4 grid gap-6 md:grid-cols-[240px_1fr] lg:grid-cols-[260px_1fr]">
        {/* Left workspace / context rail */}
        <aside className="flex flex-col rounded-2xl bg-[var(--bb-bg-page)]/60 p-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--bb-text-muted)] uppercase">
              Operations overview
            </p>
            <h2 className="mt-2 text-sm font-semibold text-[var(--bb-secondary)]">
              Cross-company work
            </h2>
            <p className="mt-1 text-[11px] text-[var(--bb-text-secondary)]">
              Monitor every request across all customer workspaces.
            </p>

            <button
              type="button"
              onClick={runAutoAssignBackfill}
              disabled={backfilling}
              className="mt-3 w-full rounded-lg bg-[var(--bb-secondary)] px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-[var(--bb-secondary)]/90 disabled:opacity-60"
              title="Re-run auto-assign for unassigned tickets (e.g. created before auto-assign was enabled)"
            >
              {backfilling ? "Assigning…" : "Re-run auto-assign"}
            </button>
          </div>

          {/* Companies list */}
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold tracking-[0.16em] text-[var(--bb-text-muted)] uppercase">
                Companies
              </p>
            </div>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setCompanyFilter("ALL")}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[11px] transition-colors ${
                  companyFilter === "ALL"
                    ? "bg-[var(--bb-bg-card)] font-semibold text-[var(--bb-secondary)]"
                    : "text-[var(--bb-text-secondary)] hover:bg-[var(--bb-bg-card)]/60"
                }`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#9CA3AF] text-[9px] font-bold text-white">
                  All
                </span>
                <span className="flex-1 truncate">All companies</span>
                <span className="text-[10px] text-[var(--bb-text-muted)]">{stats.total}</span>
              </button>
              {companiesWithCounts.map((c, i) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setCompanyFilter(companyFilter === c.name ? "ALL" : c.name)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[11px] transition-colors ${
                    companyFilter === c.name
                      ? "bg-[var(--bb-bg-card)] font-semibold text-[var(--bb-secondary)]"
                      : "text-[var(--bb-text-secondary)] hover:bg-[var(--bb-bg-card)]/60"
                  }`}
                >
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white"
                    style={{
                      backgroundColor: PROJECT_COLORS[i % PROJECT_COLORS.length],
                    }}
                  >
                    {c.name[0]?.toUpperCase()}
                  </span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-[10px] text-[var(--bb-text-muted)]">{c.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="mt-4 space-y-2">
            <div className="rounded-xl border border-[var(--bb-border-subtle)] bg-[var(--bb-bg-warm)] p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold text-[var(--bb-secondary)]">
                    All tickets
                  </p>
                  <p className="mt-0.5 text-[10px] text-[var(--bb-text-tertiary)]">
                    Board across companies.
                  </p>
                </div>
                <span className="rounded-full bg-[var(--bb-bg-page)] px-3 py-1 text-[11px] font-semibold text-[var(--bb-secondary)]">
                  {stats.total}
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-[var(--bb-bg-card)] px-3 py-2 text-[10px] text-[var(--bb-text-secondary)]">
              <p>
                Open tickets: <span className="font-semibold">{stats.openTotal}</span>
              </p>
            </div>
          </div>

          <div className="mt-auto pt-4 text-[10px] text-[var(--bb-text-tertiary)]">
            <p>You&apos;re viewing Brandbite in demo admin mode.</p>
          </div>
        </aside>

        {/* Main board area
            min-w-0 lets this grid cell shrink below the intrinsic width
            of the 4 kanban columns (4 × 320px). Without it, CSS grid's
            default min-width:auto forces the cell to 1280px wide, and
            the whole page scrolls horizontally — dragging content under
            the fixed app sidebar — instead of engaging the internal
            overflow-x-auto on the kanban strip below. */}
        <main className="flex min-w-0 flex-col">
          {/* View switcher — Kanban (this page) ↔ Table */}
          <div className="mb-3">
            <BoardViewToggle rolePath="/admin" />
          </div>

          {/* Header */}
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--bb-text-muted)] uppercase">
                Admin board
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">{activeScopeLabel}</h1>
            </div>
            {loading && (
              <div className="rounded-full bg-[var(--bb-bg-card)] px-3 py-1 text-[11px] text-[var(--bb-text-secondary)]">
                Loading board…
              </div>
            )}
          </div>

          {/* Error / alerts */}
          {error && (
            <InlineAlert variant="error" title="Something went wrong" className="mb-4">
              {error}
            </InlineAlert>
          )}

          {/* Toolbar: search + creative avatars */}
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative max-w-md flex-1">
              <input
                type="text"
                placeholder="Search board"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-2 text-xs text-[var(--bb-secondary)] outline-none focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)]"
              />
            </div>
            {/* Creative avatar circles */}
            {uniqueCreatives.length > 0 && (
              <div className="flex items-center -space-x-1.5">
                {uniqueCreatives.slice(0, 5).map((d, i) => {
                  const label = d.name || d.email;
                  return (
                    <div
                      key={i}
                      title={label}
                      className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[9px] font-bold text-white"
                      style={{ backgroundColor: avatarColor(label) }}
                    >
                      {getInitials(d.name, d.email)}
                    </div>
                  );
                })}
                {uniqueCreatives.length > 5 && (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[var(--bb-border)] text-[9px] font-bold text-[var(--bb-text-secondary)]">
                    +{uniqueCreatives.length - 5}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Columns */}
          <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 md:snap-none">
            {STATUS_ORDER.map((status) => {
              const columnTickets = ticketsByStatus[status] || [];
              const columnTitle = STATUS_LABELS[status];

              return (
                <div
                  key={status}
                  className="w-80 shrink-0 snap-start overflow-hidden rounded-2xl bg-[var(--bb-bg-page)]/60"
                >
                  {/* Accent bar */}
                  <div className="h-1" style={{ backgroundColor: columnAccentColor[status] }} />

                  <div className="p-2">
                    {/* Column header */}
                    <div className="mb-2 flex items-center gap-1">
                      <span className="text-[11px] font-semibold tracking-[0.18em] text-[var(--bb-text-tertiary)] uppercase">
                        {columnTitle}
                      </span>
                      <span className="rounded-full bg-[var(--bb-bg-card)] px-2 py-0.5 text-[11px] font-semibold text-[var(--bb-text-secondary)]">
                        {columnTickets.length}
                      </span>
                    </div>

                    {/* Cards */}
                    <div className="space-y-2">
                      {columnTickets.length === 0 ? (
                        <EmptyState title="No tickets in this column." />
                      ) : (
                        columnTickets.map((t) => {
                          const companyName = t.company?.name ?? "—";
                          const projectCode = t.project?.code ?? null;
                          const creativeLabel =
                            t.creative?.name || t.creative?.email || "Unassigned";
                          const dueLabel = formatDueDateShort(t.dueDate);
                          const overdue = isDueDateOverdue(t.dueDate);
                          const ticketCode = buildTicketCode({
                            projectCode: t.project?.code,
                            companyTicketNumber: t.companyTicketNumber,
                            ticketId: t.id,
                          });

                          return (
                            <Link
                              key={t.id}
                              href={`/admin/tickets/${t.id}`}
                              className="block rounded-xl bg-[var(--bb-bg-page)] p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                              title="Open ticket detail"
                            >
                              {/* Company name — admin-only context the
                                  customer / creative boards don't need */}
                              <p className="text-[10px] font-semibold tracking-[0.16em] text-[var(--bb-text-tertiary)] uppercase">
                                {companyName}
                              </p>
                              {/* Title */}
                              <p className="mt-0.5 text-sm leading-snug font-semibold text-[var(--bb-secondary)]">
                                {t.title}
                              </p>

                              {/* Description preview — same line-clamp-2
                                  pattern customer board uses. Stripped
                                  through stripHtml so admins don't see
                                  raw markup. */}
                              {t.description && (
                                <p className="mt-1 line-clamp-2 text-xs text-[var(--bb-text-secondary)]">
                                  {stripHtml(t.description)}
                                </p>
                              )}

                              {/* Due-date pill — red when overdue, blue otherwise */}
                              {dueLabel && (
                                <div className="mt-2">
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                      overdue
                                        ? "bg-[var(--bb-danger-bg)] text-[var(--bb-danger-text)]"
                                        : "bg-[var(--bb-info-bg)] text-[var(--bb-info-text)]"
                                    }`}
                                  >
                                    <span className="text-[9px]">📅</span>
                                    {dueLabel}
                                  </span>
                                </div>
                              )}

                              {/* Tags row (truncate to 3 + count remainder) */}
                              {t.tags && t.tags.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {t.tags.slice(0, 3).map((tag) => (
                                    <TagBadge
                                      key={tag.id}
                                      name={tag.name}
                                      color={tag.color as TagColorKey}
                                    />
                                  ))}
                                  {t.tags.length > 3 && (
                                    <span className="inline-flex items-center text-[10px] text-[var(--bb-text-tertiary)]">
                                      +{t.tags.length - 3}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Footer: ticket code + priority icon + creative avatar */}
                              <div className="mt-2.5 flex items-center justify-between border-t border-[var(--bb-border-subtle)] pt-2 text-[10px] text-[var(--bb-text-tertiary)]">
                                <div className="flex items-center gap-2">
                                  {projectCode ? (
                                    <span className="font-medium">{projectCode}</span>
                                  ) : (
                                    <span className="font-medium">{ticketCode}</span>
                                  )}
                                  {t.jobType && (
                                    <span className="hidden text-[var(--bb-text-tertiary)] sm:inline">
                                      · {t.jobType.name}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-[11px] ${priorityColorClass(t.priority)}`}
                                    title={formatPriorityLabel(t.priority)}
                                  >
                                    {priorityIconMap[t.priority]}
                                  </span>
                                  <div
                                    title={creativeLabel}
                                    className="flex h-6 w-6 items-center justify-center rounded-full text-[8px] font-bold text-white"
                                    style={{
                                      backgroundColor: avatarColor(creativeLabel),
                                    }}
                                  >
                                    {getInitials(
                                      t.creative?.name ?? null,
                                      t.creative?.email ?? null,
                                    )}
                                  </div>
                                </div>
                              </div>
                            </Link>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </>
  );
}
