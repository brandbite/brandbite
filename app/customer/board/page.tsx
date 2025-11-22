// -----------------------------------------------------------------------------
// @file: app/customer/board/page.tsx
// @purpose: Customer-facing board view of company tickets (kanban-style + drag & drop + detail modal)
// @version: v1.6.0
// @status: active
// @lastUpdate: 2025-11-23
// -----------------------------------------------------------------------------

"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CompanyRole,
  normalizeCompanyRole,
  canMoveTicketsOnBoard,
} from "@/lib/permissions/companyRoles";
import { CustomerNav } from "@/components/navigation/customer-nav";

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
  }
};

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

  const [companyRole, setCompanyRole] = useState<CompanyRole | null>(null);
  const [companyRoleLoading, setCompanyRoleLoading] =
    useState<boolean>(true);

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

  // detail modal state
  const [detailTicketId, setDetailTicketId] = useState<string | null>(null);

  // DONE confirmation modal state
  const [pendingDoneTicketId, setPendingDoneTicketId] = useState<
    string | null
  >(null);

  // click vs drag algısı için mousedown bilgisi
  const [mouseDownInfo, setMouseDownInfo] = useState<{
    ticketId: string;
    x: number;
    y: number;
    time: number;
  } | null>(null);

  // Role’den derive edilen izinler
  const canMoveOnBoard =
    companyRole != null ? canMoveTicketsOnBoard(companyRole) : true;

  const isLimitedAccess = companyRole != null && !canMoveOnBoard;

  // DONE özel izni: sadece OWNER + PM (site adminler bu view'u normalde kullanmıyor)
  const canMarkDoneOnBoard =
    companyRole != null
      ? companyRole === "OWNER" || companyRole === "PM"
      : true;

  // ---------------------------------------------------------------------------
  // Data load
  // ---------------------------------------------------------------------------

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
          throw new Error("You need to sign in to view the board.");
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
    } catch (err: unknown) {
      console.error("Customer board fetch error:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load customer board.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const persistTicketStatus = async (
    ticketId: string,
    status: TicketStatus,
  ) => {
    setMutationError(null);
    setUpdatingTicketId(ticketId);

    try {
      const res = await fetch("/api/customer/tickets/status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ticketId,
          status,
        }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("You need to sign in to update tickets.");
        }
        if (res.status === 403) {
          throw new Error(
            json?.error ||
              "You do not have permission to update tickets for this company.",
          );
        }
        const msg =
          json?.error || `Request failed with status ${res.status}`;
        throw new Error(msg);
      }

      // optimistic update
      setData((prev) => {
        if (!prev) return prev;
        const nextTickets = prev.tickets.map((t) =>
          t.id === ticketId ? { ...t, status } : t,
        );
        return {
          tickets: nextTickets,
          stats: computeStats(nextTickets),
        };
      });
    } catch (err: unknown) {
      console.error("Update ticket status error:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Failed to update ticket status. Please try again.";
      setMutationError(message);
      await load();
    } finally {
      setUpdatingTicketId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

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

  useEffect(() => {
    let cancelled = false;

    const loadRole = async () => {
      try {
        const res = await fetch("/api/customer/settings", {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          return;
        }

        if (!cancelled) {
          const role = normalizeCompanyRole(
            json?.user?.companyRole ?? null,
          );
          setCompanyRole(role);
        }
      } catch (err) {
        console.error(
          "[CustomerBoardPage] Failed to load company role from settings endpoint",
          err,
        );
      } finally {
        if (!cancelled) {
          setCompanyRoleLoading(false);
        }
      }
    };

    loadRole();

    return () => {
      cancelled = true;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const tickets = data?.tickets ?? [];

  const projects = useMemo(() => {
    const list = Array.from(
      new Set(
        tickets
          .map((t) => t.project?.name)
          .filter((p): p is string => !!p),
      ),
    );
    list.sort((a, b) => a.localeCompare(b));
    return list;
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (projectFilter !== "ALL" && t.project?.name !== projectFilter) {
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

  const ticketsByStatus = useMemo(() => {
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

  const activeProjectTitle =
    projectFilter === "ALL"
      ? "All projects"
      : projects.includes(projectFilter)
      ? projectFilter
      : "Board";

  const detailTicket = useMemo(() => {
    if (!detailTicketId) return null;
    return tickets.find((t) => t.id === detailTicketId) ?? null;
  }, [detailTicketId, tickets]);

  const pendingDoneTicket = useMemo(() => {
    if (!pendingDoneTicketId) return null;
    return (
      tickets.find((t) => t.id === pendingDoneTicketId) ?? null
    );
  }, [pendingDoneTicketId, tickets]);

  // ---------------------------------------------------------------------------
  // Drag & drop helpers – hibrit akış
  //
  // Kurallar:
  // - Sadece TODO ve IN_REVIEW kartları sürüklenebilir.
  // - Status değişimi:
  //     * IN_REVIEW → DONE (onay)
  //     * IN_REVIEW → IN_PROGRESS (revize, tasarımcıya geri)
  // - Diğer tüm status değişimleri reddedilir (frontend + backend).
  // ---------------------------------------------------------------------------

  type DropDecision = {
    allowed: boolean;
    reason?: string;
    willMarkDone?: boolean;
    willSendBackToInProgress?: boolean;
  };

  const canDropTicketToStatus = (
    ticket: CustomerBoardTicket,
    targetStatus: TicketStatus,
  ): DropDecision => {
    // Aynı kolona bırakmak serbest (no-op)
    if (targetStatus === ticket.status) {
      return { allowed: true };
    }

    // IN_REVIEW'ten iki anlamlı hareket var: DONE veya IN_PROGRESS
    if (ticket.status === "IN_REVIEW") {
      if (targetStatus === "DONE") {
        return { allowed: true, willMarkDone: true };
      }
      if (targetStatus === "IN_PROGRESS") {
        return { allowed: true, willSendBackToInProgress: true };
      }
      return {
        allowed: false,
        reason:
          "From review you can either mark the ticket as done or send it back to your designer.",
      };
    }

    // TODO → IN_PROGRESS gibi hareketler designer'a ait
    if (ticket.status === "TODO") {
      return {
        allowed: false,
        reason:
          "To start work on a ticket, your designer needs to pick it up into In progress.",
      };
    }

    // IN_PROGRESS kolonunu sadece designer yönetir
    if (ticket.status === "IN_PROGRESS") {
      return {
        allowed: false,
        reason:
          "Only your designer can move tickets that are currently in progress.",
      };
    }

    // DONE kolonu artık tamamlanmış işler için
    if (ticket.status === "DONE") {
      return {
        allowed: false,
        reason: "Completed tickets can't be moved on the board.",
      };
    }

    return {
      allowed: false,
      reason: "This move is not allowed for your role.",
    };
  };

  const handleDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    ticketId: string,
    ticketStatus: TicketStatus,
  ) => {
    if (isLimitedAccess) {
      event.preventDefault();
      return;
    }

    // Sadece TODO ve IN_REVIEW kartları sürüklenebilir
    if (ticketStatus !== "TODO" && ticketStatus !== "IN_REVIEW") {
      event.preventDefault();
      return;
    }

    setDraggingTicketId(ticketId);
    setMutationError(null);
    setMouseDownInfo(null); // drag başladıysa click saymayalım
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
    if (isLimitedAccess || !draggingTicketId) {
      return;
    }

    const ticket = tickets.find((t) => t.id === draggingTicketId);
    if (!ticket) return;

    const decision = canDropTicketToStatus(ticket, status);
    if (!decision.allowed) {
      return;
    }

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
    if (isLimitedAccess || !draggingTicketId) {
      setDraggingTicketId(null);
      setDragOverStatus(null);
      return;
    }

    const ticket = tickets.find((t) => t.id === draggingTicketId);
    setDraggingTicketId(null);
    setDragOverStatus(null);

    if (!ticket) return;

    const decision = canDropTicketToStatus(ticket, status);

    if (!decision.allowed) {
      if (decision.reason) {
        setMutationError(decision.reason);
      }
      return;
    }

    // Aynı kolona bırakma → no-op
    if (status === ticket.status) {
      return;
    }

    // IN_REVIEW → DONE → confirm modal
    if (decision.willMarkDone && status === "DONE") {
      if (!canMarkDoneOnBoard) {
        setMutationError(
          "You don't have permission to mark tickets as done. Please ask your company owner or project manager.",
        );
        return;
      }
      setPendingDoneTicketId(ticket.id);
      return;
    }

    // IN_REVIEW → IN_PROGRESS → revize (plan limiti backend'de)
    if (decision.willSendBackToInProgress && status === "IN_PROGRESS") {
      await persistTicketStatus(ticket.id, "IN_PROGRESS");
      return;
    }

    // Teorik olarak buraya düşmemeli ama güvenlik için
    await persistTicketStatus(ticket.id, status);
  };

  // ---------------------------------------------------------------------------
  // Detail & DONE-confirmation helpers
  // ---------------------------------------------------------------------------

  const closeTicketDetails = () => {
    setDetailTicketId(null);
  };

  const handleConfirmDone = async () => {
    if (!pendingDoneTicketId) return;
    const ticketId = pendingDoneTicketId;
    setPendingDoneTicketId(null);
    await persistTicketStatus(ticketId, "DONE");
  };

  const handleCancelDone = () => {
    setPendingDoneTicketId(null);
  };

  // ---------------------------------------------------------------------------
  // Rendering helpers
  // ---------------------------------------------------------------------------

  const formatStatusLabel = (status: TicketStatus): string =>
    STATUS_LABELS[status];

  const formatPriorityLabel = (priority: TicketPriority): string => {
    switch (priority) {
      case "LOW":
        return "Low";
      case "MEDIUM":
        return "Medium";
      case "HIGH":
        return "High";
      case "URGENT":
        return "Urgent";
    }
  };

  const priorityPillClass = (priority: TicketPriority): string => {
    switch (priority) {
      case "LOW":
        return "bg-[#f5f3f0] text-[#6b6a64]";
      case "MEDIUM":
        return "bg-[#eaf4ff] text-[#1d72b8]";
      case "HIGH":
        return "bg-[#fff7e0] text-[#8a6b1f]";
      case "URGENT":
        return "bg-[#fde8e7] text-[#b13832]";
    }
  };

  const formatDate = (iso: string | null): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString();
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#f5f3f0] text-[#424143]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <CustomerNav />

        <div className="flex gap-4">
          {/* Sidebar: stats + project filters */}
          <aside className="w-60 flex-shrink-0 rounded-3xl border border-[#e3e1dc] bg-white px-4 py-4 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b1afa9]">
              Overview
            </h2>

            <div className="mt-3 rounded-2xl bg-[#f5f3f0] px-3 py-3 text-xs">
              <p className="text-[11px] font-medium text-[#7a7a7a]">
                Tickets on board
              </p>
              <p className="mt-1 text-2xl font-semibold text-[#424143]">
                {loading ? "—" : stats.total}
              </p>
              <div className="mt-3 space-y-1 text-[11px] text-[#7a7a7a]">
                <p>
                  Backlog:{" "}
                  <span className="font-semibold">
                    {loading ? "—" : stats.byStatus.TODO}
                  </span>
                </p>
                <p>
                  In progress:{" "}
                  <span className="font-semibold">
                    {loading ? "—" : stats.byStatus.IN_PROGRESS}
                  </span>
                </p>
                <p>
                  In review:{" "}
                  <span className="font-semibold">
                    {loading ? "—" : stats.byStatus.IN_REVIEW}
                  </span>
                </p>
                <p>
                  Done:{" "}
                  <span className="font-semibold">
                    {loading ? "—" : stats.byStatus.DONE}
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b1afa9]">
                Projects
              </p>
              <div className="mt-2 space-y-1 text-xs">
                <button
                  type="button"
                  onClick={() => setProjectFilter("ALL")}
                  className={`flex w-full items-center justify-between rounded-2xl px-3 py-2 text-sm ${
                    projectFilter === "ALL"
                      ? "bg-[#f5f3f0] text-[#424143]"
                      : "text-[#424143] hover:bg-[#f7f5f0]"
                  }`}
                >
                  <span>All projects</span>
                  <span className="text-[11px] text-[#9a9892]">
                    {projects.length}
                  </span>
                </button>
                <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                  {projects.length === 0 ? (
                    <p className="py-2 text-[11px] text-[#9a9892]">
                      No projects yet.
                    </p>
                  ) : (
                    projects.map((projectName) => {
                      const isActive = projectFilter === projectName;
                      return (
                        <button
                          key={projectName}
                          type="button"
                          onClick={() => setProjectFilter(projectName)}
                          className={`flex w-full items_center justify-between rounded-2xl px-3 py-2 text-sm ${
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
              </div>
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
                  Use this board to track your requests as they move from
                  backlog to design and review. Your designer controls{" "}
                  <span className="font-semibold">In progress</span> and{" "}
                  <span className="font-semibold">In review</span>. From
                  review, you can either mark a ticket as done or send it back
                  for further work.
                </p>

                {/* Project selector for mobile */}
                {projects.length > 0 && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#e3e1dc] bg-[#f5f3f0] px-3 py-1 text-[11px] text-[#7a7a7a] md:hidden">
                    <span>Project:</span>
                    <select
                      className="bg-transparent text-[11px] outline-none"
                      value={projectFilter}
                      onChange={(e) => setProjectFilter(e.target.value)}
                    >
                      <option value="ALL">All projects</option>
                      {projects.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {loading && (
                <div className="rounded-full bg-[#f5f3f0] px-3 py-1 text-[11px] text-[#7a7a7a]">
                  Loading board…
                </div>
              )}
            </div>

            {/* Limited access */}
            {!error && !companyRoleLoading && isLimitedAccess && (
              <div className="mb-4 rounded-xl border border-[#f6c89f] bg-[#fff4e6] px-4 py-3 text-xs text-[#7a7a7a]">
                <p className="text-[11px] font-medium text-[#9a5b2b]">
                  Limited access
                </p>
                <p className="mt-1">
                  You can review tickets on the board, but only your company
                  owner or project manager can move them between statuses.
                </p>
              </div>
            )}

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
                  type="text"
                  placeholder="Search by title, ticket code, project, designer or job type"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-full border border-[#e3e1dc] bg-[#f7f5f0] px-4 py-2 text-xs text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
                />
              </div>
            </div>

            {/* Columns */}
            <div className="grid gap-3 md:grid-cols-4">
              {STATUS_ORDER.map((status) => {
                const columnTickets = ticketsByStatus[status] || [];
                const columnTitle = formatStatusLabel(status);
                const isActiveDrop =
                  dragOverStatus === status && !!draggingTicketId;

                const isDesignerManagedColumn =
                  status === "IN_PROGRESS" || status === "IN_REVIEW";

                return (
                  <div
                    key={status}
                    className={`flex flex-col rounded-2xl bg-white/60 p-2 ${
                      isActiveDrop ? "ring-2 ring-[#f15b2b]" : "ring-0"
                    }`}
                    onDragOver={(event) =>
                      handleColumnDragOver(event, status)
                    }
                    onDrop={(event) => handleColumnDrop(event, status)}
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
                      {isDesignerManagedColumn && (
                        <p className="mt-1 text-[10px] text-[#b1afa9]">
                          {status === "IN_PROGRESS"
                            ? "Managed by your designer – they pick work into this column."
                            : "Sent by your designer when a ticket is ready for your review."}
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
                          const ticketCode =
                            t.project?.code && t.companyTicketNumber != null
                              ? `${t.project.code}-${t.companyTicketNumber}`
                              : t.companyTicketNumber != null
                              ? `#${t.companyTicketNumber}`
                              : t.id;

                          const payoutTokens =
                            t.jobType?.designerPayoutTokens ??
                            t.jobType?.tokenCost ??
                            null;

                          const isUpdating = updatingTicketId === t.id;

                          const canDragThisCard =
                            !isUpdating &&
                            !isLimitedAccess &&
                            (t.status === "TODO" ||
                              t.status === "IN_REVIEW");

                          return (
                            <div
                              key={t.id}
                              className={`cursor-pointer rounded-xl bg_white p-3 shadow-sm ${
                                isUpdating ? "opacity-60" : ""
                              }`}
                              draggable={canDragThisCard}
                              onDragStart={(event) =>
                                handleDragStart(event, t.id, t.status)
                              }
                              onDragEnd={handleDragEnd}
                              onMouseDown={(e) =>
                                setMouseDownInfo({
                                  ticketId: t.id,
                                  x: e.clientX,
                                  y: e.clientY,
                                  time: Date.now(),
                                })
                              }
                              onMouseUp={(e) => {
                                if (!mouseDownInfo) return;
                                const dx = e.clientX - mouseDownInfo.x;
                                const dy = e.clientY - mouseDownInfo.y;
                                const dt = Date.now() - mouseDownInfo.time;
                                setMouseDownInfo(null);
                                const distance = Math.sqrt(
                                  dx * dx + dy * dy,
                                );
                                if (
                                  distance < 5 &&
                                  dt < 400 &&
                                  !draggingTicketId
                                ) {
                                  setDetailTicketId(t.id);
                                }
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <div className="text-[11px] font-semibold text-[#424143]">
                                  {ticketCode}
                                </div>
                                <div className="text-[10px] text-[#9a9892]">
                                  {t.project?.name || "—"}
                                </div>
                              </div>
                              <div className="mt-1 text-[13px] font-semibold text-[#424143]">
                                {t.title}
                              </div>
                              {t.description && (
                                <p className="mt-1 line-clamp-3 text-[11px] text-[#7a7a7a]">
                                  {t.description}
                                </p>
                              )}
                              <div className="mt-2 flex flex_wrap items-center gap-2">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${priorityPillClass(
                                    t.priority,
                                  )}`}
                                >
                                  {formatPriorityLabel(t.priority)}
                                </span>
                                {t.designer && (
                                  <span className="rounded-full bg-[#f5f3f0] px-2 py-0.5 text-[10px] text-[#7a7a7a]">
                                    {t.designer.name || t.designer.email}
                                  </span>
                                )}
                                {payoutTokens != null && (
                                  <span className="rounded-full bg-[#f0fff6] px-2 py-0.5 text-[10px] text-[#137a3a]">
                                    {payoutTokens} tokens
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 flex items-center justify-between text-[10px] text-[#9a9892]">
                                <span>Created {formatDate(t.createdAt)}</span>
                                <span>Updated {formatDate(t.updatedAt)}</span>
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

      {/* Detail modal */}
      {detailTicket && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4 py-8">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b1afa9]">
                  Ticket
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[#424143]">
                  {detailTicket.title}
                </h2>
                <p className="mt-1 text-[11px] text-[#7a7a7a]">
                  Status:{" "}
                  <span className="font-semibold">
                    {formatStatusLabel(detailTicket.status)}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={closeTicketDetails}
                className="rounded-full bg-[#f5f3f0] px-3 py-1 text-[11px] font-medium text-[#424143] hover:bg-[#eeeae3]"
              >
                Close
              </button>
            </div>

            {detailTicket.description && (
              <div className="mb-3 rounded-xl bg-[#f5f3f0] px-3 py-3 text-[11px] text-[#424143]">
                {detailTicket.description}
              </div>
            )}

            <div className="grid gap-3 text-[11px] text-[#7a7a7a] md:grid-cols-2">
              <div>
                <p className="font-semibold text-[#424143]">Meta</p>
                <div className="mt-1 space-y-1">
                  <p>
                    Priority:{" "}
                    <span className="font-semibold">
                      {formatPriorityLabel(detailTicket.priority)}
                    </span>
                  </p>
                  <p>
                    Project:{" "}
                    <span className="font-semibold">
                      {detailTicket.project?.name || "—"}
                    </span>
                  </p>
                  <p>
                    Job type:{" "}
                    <span className="font-semibold">
                      {detailTicket.jobType?.name || "—"}
                    </span>
                  </p>
                </div>
              </div>
              <div>
                <p className="font-semibold text-[#424143]">People</p>
                <div className="mt-1 space-y-1">
                  <p>
                    Designer:{" "}
                    <span className="font-semibold">
                      {detailTicket.designer?.name ||
                        detailTicket.designer?.email ||
                        "—"}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-3 text-[11px] text-[#7a7a7a] md:grid-cols-2">
              <div>
                <p className="font-semibold text-[#424143]">Dates</p>
                <div className="mt-1 space-y-1">
                  <p>
                    Created:{" "}
                    <span className="font-semibold">
                      {formatDate(detailTicket.createdAt)}
                    </span>
                  </p>
                  <p>
                    Updated:{" "}
                    <span className="font-semibold">
                      {formatDate(detailTicket.updatedAt)}
                    </span>
                  </p>
                  <p>
                    Due date:{" "}
                    <span className="font-semibold">
                      {formatDate(detailTicket.dueDate)}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DONE confirmation modal */}
      {pendingDoneTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-8">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-sm font-semibold text-[#424143]">
              Mark this request as done?
            </h2>
            <p className="mt-2 text-[11px] text-[#7a7a7a]">
              Are you sure you want to mark{" "}
              <span className="font-semibold">
                {pendingDoneTicket.title}
              </span>{" "}
              as done? This will close the request and count as a completed job
              for your designer.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2 text-[11px]">
              <button
                type="button"
                onClick={handleCancelDone}
                className="rounded-full border border-[#e3e1dc] bg-white px-3 py-1 text-[#424143] hover:bg-[#f5f3f0]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDone}
                className="rounded-full bg-[#f15b2b] px-3 py-1 font-medium text-white hover:bg-[#e14e22]"
              >
                Mark as done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
