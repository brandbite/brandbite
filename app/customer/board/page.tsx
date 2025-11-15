// -----------------------------------------------------------------------------
// @file: app/customer/board/page.tsx
// @purpose: Customer-facing board view of company tickets (kanban-style + drag & drop)
// @version: v1.2.0
// @status: active
// @lastUpdate: 2025-11-16
// -----------------------------------------------------------------------------

"use client";

import React, { useEffect, useMemo, useState } from "react";

type TicketStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type CustomerBoardTicket = {
  id: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  dueDate: string | null;
  companyTicketNumber: number | null;
  createdAt: string;
  updatedAt: string;
  project: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  designer: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  jobType: {
    id: string;
    name: string;
    tokenCost: number;
    designerPayoutTokens: number;
  } | null;
};

type BoardStats = {
  byStatus: Record<TicketStatus, number>;
  total: number;
};

type CustomerBoardResponse = {
  stats: BoardStats;
  tickets: CustomerBoardTicket[];
};

const STATUS_ORDER: TicketStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
];

const computeStats = (tickets: CustomerBoardTicket[]): BoardStats => {
  const base: Record<TicketStatus, number> = {
    TODO: 0,
    IN_PROGRESS: 0,
    IN_REVIEW: 0,
    DONE: 0,
  };
  for (const t of tickets) {
    base[t.status] = (base[t.status] ?? 0) + 1;
  }
  return {
    byStatus: base,
    total: tickets.length,
  };
};

export default function CustomerBoardPage() {
  const [data, setData] = useState<CustomerBoardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [projectFilter, setProjectFilter] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");

  // drag & drop state
  const [draggingTicketId, setDraggingTicketId] = useState<string | null>(
    null,
  );
  const [dragOverStatus, setDragOverStatus] =
    useState<TicketStatus | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(
    null,
  );

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/customer/board", {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error(
            "You must be signed in as a customer to view this page.",
          );
        }
        if (res.status === 403) {
          throw new Error(
            "You do not have permission to view the customer board.",
          );
        }
        const msg =
          json?.error || `Request failed with status ${res.status}`;
        throw new Error(msg);
      }

      const payload = json as CustomerBoardResponse;
      const normalized: CustomerBoardResponse = {
        tickets: payload.tickets,
        stats: computeStats(payload.tickets),
      };

      setData(normalized);
    } catch (err: any) {
      console.error("Customer board fetch error:", err);
      setError(err?.message || "Failed to load customer board.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const initialLoad = async () => {
      if (cancelled) return;
      await load();
    };

    initialLoad();

    return () => {
      cancelled = true;
    };
  }, []);

  const tickets = data?.tickets ?? [];

  const projects = useMemo(() => {
    const list = Array.from(
      new Set(
        tickets
          .map((t) => t.project?.name)
          .filter((p): p is string => !!p),
      ),
    );
    return list;
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (
        projectFilter !== "ALL" &&
        t.project?.name !== projectFilter
      ) {
        return false;
      }

      const q = search.trim().toLowerCase();
      if (q) {
        const code =
          t.project?.code && t.companyTicketNumber != null
            ? `${t.project.code}-${t.companyTicketNumber}`
            : t.companyTicketNumber != null
            ? `#${t.companyTicketNumber}`
            : t.id;
        const haystack = [
          code,
          t.title,
          t.description ?? "",
          t.project?.name ?? "",
          t.designer?.name ?? "",
          t.designer?.email ?? "",
          t.jobType?.name ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [tickets, projectFilter, search]);

  const ticketsByStatus: Record<TicketStatus, CustomerBoardTicket[]> =
    useMemo(() => {
      const map: Record<TicketStatus, CustomerBoardTicket[]> = {
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

  const stats = data?.stats ?? computeStats(tickets);

  const formatStatusLabel = (status: TicketStatus) => {
    switch (status) {
      case "TODO":
        return "To do";
      case "IN_PROGRESS":
        return "In progress";
      case "IN_REVIEW":
        return "In review";
      case "DONE":
        return "Done";
    }
  };

  const statusColumnClass = (status: TicketStatus) => {
    switch (status) {
      case "TODO":
        return "bg-[#f7f5ff]";
      case "IN_PROGRESS":
        return "bg-[#e9f6ff]";
      case "IN_REVIEW":
        return "bg-[#fff7e0]";
      case "DONE":
        return "bg-[#f0fff6]";
    }
  };

  const priorityBadgeClass = (priority: TicketPriority) => {
    switch (priority) {
      case "LOW":
        return "bg-[#eef4ff] text-[#274690]";
      case "MEDIUM":
        return "bg-[#eaf4ff] text-[#1d72b8]";
      case "HIGH":
        return "bg-[#fff7e0] text-[#8a6b1f]";
      case "URGENT":
        return "bg-[#fde8e7] text-[#b13832]";
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString();
  };

  const activeProjectTitle =
    projectFilter === "ALL" ? "All projects" : projectFilter;

  // ---------------------------------------------------------------------------
  // Drag & drop helpers
  // ---------------------------------------------------------------------------

  const updateTicketStatusLocal = (
    ticketId: string,
    newStatus: TicketStatus,
  ) => {
    setData((prev) => {
      if (!prev) return prev;
      const updatedTickets = prev.tickets.map((t) =>
        t.id === ticketId ? { ...t, status: newStatus } : t,
      );
      return {
        tickets: updatedTickets,
        stats: computeStats(updatedTickets),
      };
    });
  };

  const persistTicketStatus = async (
    ticketId: string,
    newStatus: TicketStatus,
  ) => {
    setMutationError(null);
    setUpdatingTicketId(ticketId);

    // optimistic update
    updateTicketStatusLocal(ticketId, newStatus);

    try {
      const res = await fetch("/api/customer/tickets/status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ticketId,
          status: newStatus,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          json?.error ||
          `Failed to update ticket status (status ${res.status})`;
        throw new Error(msg);
      }
    } catch (err: any) {
      console.error("Update ticket status error:", err);
      setMutationError(
        err?.message || "Failed to update ticket status. Please try again.",
      );
      // reload from server to be safe
      await load();
    } finally {
      setUpdatingTicketId(null);
    }
  };

  const handleDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    ticketId: string,
  ) => {
    setDraggingTicketId(ticketId);
    setMutationError(null);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", ticketId);
    }
  };

  const handleDragEnd = () => {
    setDraggingTicketId(null);
    setDragOverStatus(null);
  };

  const handleColumnDragOver = (
    event: React.DragEvent<HTMLDivElement>,
    status: TicketStatus,
  ) => {
    event.preventDefault();
    if (dragOverStatus !== status) {
      setDragOverStatus(status);
    }
  };

  const handleColumnDrop = async (
    event: React.DragEvent<HTMLDivElement>,
    status: TicketStatus,
  ) => {
    event.preventDefault();
    if (!draggingTicketId) return;
    const ticketId = draggingTicketId;
    setDraggingTicketId(null);
    setDragOverStatus(null);
    await persistTicketStatus(ticketId, status);
  };

  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#f5f3f0] text-[#424143]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Top navigation */}
        <header className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f15b2b] text-sm font-semibold text-white">
              B
            </div>
            <span className="text-lg font-semibold tracking-tight">
              Brandbite
            </span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-[#7a7a7a] md:flex">
            <button
              className="font-medium text-[#7a7a7a]"
              onClick={() => (window.location.href = "/customer/tokens")}
            >
              Tokens
            </button>
            <button
              className="font-medium text-[#7a7a7a]"
              onClick={() =>
                (window.location.href = "/customer/tickets")
              }
            >
              Tickets
            </button>
            <button className="font-semibold text-[#424143]">
              Board
            </button>
          </nav>
        </header>

        <div className="mt-4 flex flex-col gap-4 md:flex-row">
          {/* Projects sidebar (desktop) */}
          <aside className="hidden w-60 flex-shrink-0 flex-col rounded-3xl border border-[#e3e1dc] bg-white px-4 py-4 shadow-sm md:flex">
            <div className="mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b1afa9]">
                Projects
              </p>
            </div>
            <button
              type="button"
              onClick={() => setProjectFilter("ALL")}
              className={`mb-2 flex items-center justify-between rounded-2xl px-3 py-2 text-sm ${
                projectFilter === "ALL"
                  ? "bg-[#f15b2b] text-white"
                  : "text-[#424143] hover:bg-[#f5f3f0]"
              }`}
            >
              <span>All projects</span>
              {stats && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    projectFilter === "ALL"
                      ? "bg-white/20"
                      : "bg-[#f0ede6] text-[#7a7a7a]"
                  }`}
                >
                  {stats.total}
                </span>
              )}
            </button>

            <div className="mt-1 space-y-1">
              {projects.length === 0 ? (
                <p className="px-1 py-2 text-xs text-[#9a9892]">
                  No projects yet. Tickets will appear here once created.
                </p>
              ) : (
                projects.map((projectName) => {
                  const isActive = projectFilter === projectName;
                  return (
                    <button
                      key={projectName}
                      type="button"
                      onClick={() => setProjectFilter(projectName)}
                      className={`flex w-full items-center justify-between rounded-2xl px-3 py-2 text-sm ${
                        isActive
                          ? "bg-[#f5f3f0] text-[#424143]"
                          : "text-[#424143] hover:bg-[#f7f5f0]"
                      }`}
                    >
                      <span className="truncate">{projectName}</span>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Main board area */}
          <main className="flex-1 rounded-3xl border border-[#e3e1dc] bg-white/80 px-4 py-5 shadow-sm">
            {/* Page header */}
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b1afa9]">
                  Board
                </p>
                <h1 className="mt-1 text-xl font-semibold tracking-tight">
                  {activeProjectTitle}
                </h1>
                <p className="mt-1 text-xs text-[#7a7a7a]">
                  Drag cards between columns to update their status.
                </p>

                {/* Project selector for mobile (since sidebar is hidden) */}
                {projects.length > 0 && (
                  <div className="mt-3 flex items-center gap-2 text-xs md:hidden">
                    <span className="text-[#7a7a7a]">Project</span>
                    <select
                      value={projectFilter}
                      onChange={(e) =>
                        setProjectFilter(e.target.value)
                      }
                      className="rounded-xl border border-[#d4d2cc] bg-[#fbfaf8] px-2 py-1 text-xs text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
                    >
                      <option value="ALL">All projects</option>
                      {projects.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Simple stats pills */}
              {stats && (
                <div className="flex flex-wrap justify-end gap-2 text-[11px]">
                  <div className="rounded-full bg-[#f5f3f0] px-3 py-1 font-medium text-[#424143]">
                    Total: {stats.total}
                  </div>
                  {STATUS_ORDER.map((s) => (
                    <div
                      key={s}
                      className="rounded-full bg-[#f5f3f0] px-3 py-1 text-[#7a7a7a]"
                    >
                      {formatStatusLabel(s)}:{" "}
                      {stats.byStatus?.[s] ?? 0}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-[#fff7f7] px-4 py-3 text-xs text-red-700">
                <p className="font-medium">Error</p>
                <p className="mt-1">{error}</p>
              </div>
            )}

            {/* Mutation error */}
            {mutationError && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-[#fffaf2] px-4 py-3 text-xs text-amber-800">
                {mutationError}
              </div>
            )}

            {/* Search bar */}
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative flex-1">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by ticket, project, designer..."
                  className="w-full rounded-full border border-[#d4d2cc] bg-[#fbfaf8] px-4 py-2.5 pr-9 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
                />
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs text-[#b1afa9]">
                  🔍
                </span>
              </div>
            </div>

            {/* Board grid */}
            <section className="rounded-2xl bg-[#f7f5f0] p-2">
              {loading ? (
                <div className="py-6 text-center text-sm text-[#7a7a7a]">
                  Loading board…
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-4">
                  {STATUS_ORDER.map((status) => {
                    const columnTickets = ticketsByStatus[status] || [];
                    const columnTitle = formatStatusLabel(status);
                    const isActiveDrop =
                      dragOverStatus === status && !!draggingTicketId;

                    return (
                      <div
                        key={status}
                        className={`flex flex-col rounded-2xl bg-white/60 p-2 ${
                          isActiveDrop
                            ? "ring-2 ring-[#f15b2b]"
                            : "ring-0"
                        }`}
                        onDragOver={(event) =>
                          handleColumnDragOver(event, status)
                        }
                        onDrop={(event) =>
                          handleColumnDrop(event, status)
                        }
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9a9892]">
                              {columnTitle}
                            </span>
                            <span className="rounded-full bg-[#f5f3f0] px-2 py-0.5 text-[11px] font-semibold text-[#7a7a7a]">
                              {columnTickets.length}
                            </span>
                          </div>
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
                              const ticketCode =
                                t.project?.code &&
                                t.companyTicketNumber != null
                                  ? `${t.project.code}-${t.companyTicketNumber}`
                                  : t.companyTicketNumber != null
                                  ? `#${t.companyTicketNumber}`
                                  : t.id;

                              const payoutTokens =
                                t.jobType?.tokenCost ?? null;

                              const isUpdating =
                                updatingTicketId === t.id;

                              return (
                                <div
                                  key={t.id}
                                  className={`rounded-xl bg-white p-3 shadow-sm ${
                                    isUpdating ? "opacity-60" : ""
                                  }`}
                                  draggable={!isUpdating}
                                  onDragStart={(event) =>
                                    handleDragStart(event, t.id)
                                  }
                                  onDragEnd={handleDragEnd}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="text-[11px] font-semibold text-[#424143]">
                                      {ticketCode}
                                    </div>
                                    <span
                                      className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${priorityBadgeClass(
                                        t.priority,
                                      )}`}
                                    >
                                      {t.priority}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-[11px] font-medium text-[#424143]">
                                    {t.title}
                                  </p>
                                  {t.project && (
                                    <p className="mt-1 text-[10px] text-[#7a7a7a]">
                                      {t.project.name}
                                    </p>
                                  )}
                                  <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[10px] text-[#9a9892]">
                                    <div className="flex flex-col">
                                      <span className="font-medium text-[#7a7a7a]">
                                        {t.designer
                                          ? t.designer.name ||
                                            t.designer.email
                                          : "Unassigned"}
                                      </span>
                                      {t.jobType && (
                                        <span>
                                          {t.jobType.name}
                                          {payoutTokens
                                            ? ` • ${payoutTokens} tokens`
                                            : ""}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <span className="block">
                                        Due: {formatDate(t.dueDate)}
                                      </span>
                                    </div>
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
              )}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
