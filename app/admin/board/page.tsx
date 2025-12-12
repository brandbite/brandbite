// -----------------------------------------------------------------------------
// @file: app/admin/board/page.tsx
// @purpose: Admin-facing kanban board over all tickets (read-only, unified UI)
// @version: v1.1.0
// @status: active
// @lastUpdate: 2025-12-12
// -----------------------------------------------------------------------------

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AdminNav } from "@/components/navigation/admin-nav";
import { useToast } from "@/components/ui/toast-provider";

type TicketStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";

type AdminTicket = {
  id: string;
  title: string;
  status: TicketStatus;
  createdAt: string;
  company: { id: string; name: string } | null;
  project: { id: string; name: string; code: string | null } | null;
  designer: { id: string; name: string | null; email: string } | null;
};

type AdminTicketsResponse = {
  tickets: AdminTicket[];
};

type AdminBoardStats = {
  byStatus: Record<TicketStatus, number>;
  total: number;
  openTotal: number;
};

const STATUS_ORDER: TicketStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
];

const STATUS_LABELS: Record<TicketStatus, string> = {
  TODO: "Backlog",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  DONE: "Done",
};

const statusColumnClass = (status: TicketStatus): string => {
  switch (status) {
    case "TODO":
      return "bg-[#f5f3f0]";
    case "IN_PROGRESS":
      return "bg-[#eaf4ff]";
    case "IN_REVIEW":
      return "bg-[#fff7e0]";
    case "DONE":
      return "bg-[#e8f6f0]";
    default:
      return "bg-[#f5f3f0]";
  }
};

const formatDate = (iso: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
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
        err instanceof Error
          ? err.message
          : "Failed to load tickets. Please try again.";

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

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const stats: AdminBoardStats = useMemo(() => {
    const byStatus: Record<TicketStatus, number> = {
      TODO: 0,
      IN_PROGRESS: 0,
      IN_REVIEW: 0,
      DONE: 0,
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
          t.designer?.name ?? "",
          t.designer?.email ?? "",
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
    };

    for (const t of filteredTickets) {
      map[t.status].push(t);
    }

    return map;
  }, [filteredTickets]);

  const activeScopeLabel =
    companyFilter === "ALL" ? "All companies" : companyFilter;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#f5f3f0] text-[#424143]">
      <div className="mx-auto max-w-6xl px-6 pb-10 pt-6">
        <AdminNav />

        <div className="mt-4 grid gap-6 md:grid-cols-[240px,1fr] lg:grid-cols-[260px,1fr]">
          {/* Left workspace / context rail */}
          <aside className="flex flex-col rounded-2xl bg-white/60 p-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b1afa9]">
                Operations overview
              </p>
              <h2 className="mt-2 text-sm font-semibold text-[#424143]">
                Cross-company work
              </h2>
              <p className="mt-1 text-[11px] text-[#7a7a7a]">
                Monitor every request across all customer workspaces. This view
                is read-only and helps you spot bottlenecks and plan payouts.
              </p>
            </div>

            <div className="mt-4 space-y-2">
              <div className="rounded-xl border border-[#ece9e1] bg-[#f7f5f0] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold text-[#424143]">
                      All tickets
                    </p>
                    <p className="mt-0.5 text-[10px] text-[#9a9892]">
                      Board across companies, grouped by status.
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[#424143]">
                    {stats.total}
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-[#f5f3f0] px-3 py-2 text-[10px] text-[#7a7a7a]">
                <p>
                  Open tickets:{" "}
                  <span className="font-semibold">{stats.openTotal}</span>
                </p>
                <p className="mt-1">
                  Keep an eye on how many requests are actively moving through
                  the pipeline.
                </p>
              </div>
            </div>

            <div className="mt-auto pt-4 text-[10px] text-[#9a9892]">
              <p>You&apos;re viewing Brandbite in demo admin mode.</p>
            </div>
          </aside>

          {/* Main board area */}
          <main className="flex flex-col">
            {/* Header + description */}
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b1afa9]">
                  Admin board
                </p>
                <h1 className="mt-1 text-xl font-semibold tracking-tight">
                  {activeScopeLabel}
                </h1>
                <p className="mt-1 text-xs text-[#7a7a7a]">
                  This read-only board shows how work is flowing across the
                  entire system – from backlog to done. Filter by company or
                  search across projects and designers to quickly inspect what’s
                  happening.
                </p>
              </div>
              {loading && (
                <div className="rounded-full bg-[#f5f3f0] px-3 py-1 text-[11px] text-[#7a7a7a]">
                  Loading board…
                </div>
              )}
            </div>

            {/* Error / alerts */}
            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-[#fff7f7] px-4 py-3 text-xs text-red-700">
                <p className="font-medium">Something went wrong</p>
                <p className="mt-1">{error}</p>
              </div>
            )}

            {/* Filters */}
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search by title, company, project or designer"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-full border border-[#e3e1dc] bg-[#f7f5f0] px-4 pb-2 pt-2 text-xs text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#7a7a7a]">
                <span>Company:</span>
                <select
                  className="rounded-full border border-[#e3e1dc] bg-[#f7f5f0] px-2 py-1 text-[11px] outline-none"
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                >
                  <option value="ALL">All</option>
                  {companies.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Stats pills */}
            <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-[#7a7a7a]">
              <div className="rounded-full bg-[#f5f3f0] px-3 py-1">
                Total: <span className="font-semibold">{stats.total}</span>
              </div>
              <div className="rounded-full bg-[#f5f3f0] px-3 py-1">
                Open:{" "}
                <span className="font-semibold">{stats.openTotal}</span>
              </div>
              <div className="rounded-full bg-[#f5f3f0] px-3 py-1">
                Backlog:{" "}
                <span className="font-semibold">
                  {stats.byStatus.TODO ?? 0}
                </span>
              </div>
              <div className="rounded-full bg-[#f5f3f0] px-3 py-1">
                In progress:{" "}
                <span className="font-semibold">
                  {stats.byStatus.IN_PROGRESS ?? 0}
                </span>
              </div>
              <div className="rounded-full bg-[#f5f3f0] px-3 py-1">
                In review:{" "}
                <span className="font-semibold">
                  {stats.byStatus.IN_REVIEW ?? 0}
                </span>
              </div>
              <div className="rounded-full bg-[#f5f3f0] px-3 py-1">
                Done:{" "}
                <span className="font-semibold">
                  {stats.byStatus.DONE ?? 0}
                </span>
              </div>
            </div>

            {/* Columns */}
            <div className="grid gap-3 md:grid-cols-4">
              {STATUS_ORDER.map((status) => {
                const columnTickets = ticketsByStatus[status] || [];
                const columnTitle = STATUS_LABELS[status];

                return (
                  <div
                    key={status}
                    className="flex flex-col rounded-2xl bg-white/60 p-2"
                  >
                    <div className="mb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a9892]">
                            {columnTitle}
                          </span>
                          <span className="rounded-full bg-[#f5f3f0] px-2 py-0.5 text-[11px] font-semibold text-[#7a7a7a]">
                            {columnTickets.length}
                          </span>
                        </div>
                      </div>
                      {status === "DONE" && (
                        <p className="mt-1 text-[10px] text-[#b1afa9]">
                          Completed by customers. This board is read-only for
                          admins.
                        </p>
                      )}
                    </div>

                    <div
                      className={`flex-1 space-y-2 rounded-xl ${statusColumnClass(
                        status,
                      )} bg-opacity-70 p-2`}
                    >
                      {columnTickets.length === 0 ? (
                        <p className="py-4 text-center text-[11px] text-[#9a9892]">
                          No tickets in this column.
                        </p>
                      ) : (
                        columnTickets.map((t) => {
                          const companyName = t.company?.name ?? "—";
                          const projectName = t.project?.name ?? "—";
                          const projectCode = t.project?.code ?? null;
                          const designerLabel =
                            t.designer?.name ||
                            t.designer?.email ||
                            "Unassigned";

                          return (
                            <div
                              key={t.id}
                              className="rounded-xl bg-white p-3 text-[11px] text-[#424143] shadow-sm"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9a9892]">
                                    {companyName}
                                  </span>
                                  <span className="mt-0.5 text-[13px] font-semibold text-[#424143]">
                                    {t.title}
                                  </span>
                                </div>
                                {projectCode && (
                                  <span className="rounded-full bg-[#eaf4ff] px-2 py-0.5 text-[10px] font-semibold text-[#1d72b8]">
                                    {projectCode}
                                  </span>
                                )}
                              </div>

                              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-[#7a7a7a]">
                                <span className="rounded-full bg-[#f5f3f0] px-2 py-0.5">
                                  Project:{" "}
                                  <span className="font-semibold">
                                    {projectName}
                                  </span>
                                </span>
                                <span className="rounded-full bg-[#f5f3f0] px-2 py-0.5">
                                  Designer:{" "}
                                  <span className="font-semibold">
                                    {designerLabel}
                                  </span>
                                </span>
                              </div>

                              <div className="mt-2 text-[10px] text-[#9a9892]">
                                Created {formatDate(t.createdAt)}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
