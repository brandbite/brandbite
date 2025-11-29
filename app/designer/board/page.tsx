// -----------------------------------------------------------------------------
// @file: app/designer/board/page.tsx
// @purpose: Designer-facing kanban board for assigned tickets with revision indicators & filters
// @version: v1.3.0
// @status: experimental
// @lastUpdate: 2025-11-26
// -----------------------------------------------------------------------------

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { DesignerNav } from "@/components/navigation/designer-nav";

type TicketStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type DesignerTicket = {
  id: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  dueDate: string | null;
  companyTicketNumber: number | null;
  createdAt: string;
  updatedAt: string;
  company: {
    id: string;
    name: string;
    slug: string;
  } | null;
  project: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  jobType: {
    id: string;
    name: string;
    tokenCost: number;
    designerPayoutTokens: number;
  } | null;
  // revision info
  revisionCount: number;
  latestRevisionHasFeedback: boolean;
  latestRevisionFeedbackSnippet: string | null;
};

type DesignerTicketsStats = {
  byStatus: Record<TicketStatus, number>;
  total: number;
  openTotal: number;
  byPriority: Record<TicketPriority, number>;
  loadScore: number;
};

type DesignerTicketsResponse = {
  stats: DesignerTicketsStats;
  tickets: DesignerTicket[];
};

type TicketRevisionEntry = {
  version: number;
  submittedAt: string | null;
  feedbackAt: string | null;
  feedbackMessage: string | null;
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

const formatDate = (iso: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
};

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

export default function DesignerBoardPage() {
  const [data, setData] = useState<DesignerTicketsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState<string>("");
  const [projectFilter, setProjectFilter] = useState<string>("ALL");
  const [onlyChangesRequested, setOnlyChangesRequested] =
    useState<boolean>(false);

  const [draggingTicketId, setDraggingTicketId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] =
    useState<TicketStatus | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(null);

  const [detailTicketId, setDetailTicketId] = useState<string | null>(null);
  const [mouseDownInfo, setMouseDownInfo] = useState<{
    ticketId: string;
    x: number;
    y: number;
    time: number;
  } | null>(null);

  // detail modal – revision history state
  const [detailRevisions, setDetailRevisions] = useState<
    TicketRevisionEntry[] | null
  >(null);
  const [detailRevisionsLoading, setDetailRevisionsLoading] =
    useState<boolean>(false);
  const [detailRevisionsError, setDetailRevisionsError] = useState<
    string | null
  >(null);

  // ---------------------------------------------------------------------------
  // Data load
  // ---------------------------------------------------------------------------

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/designer/tickets", {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("You need to sign in as a designer.");
        }
        if (res.status === 403) {
          throw new Error(
            json?.error ||
              "You do not have access to designer tickets in this workspace.",
          );
        }
        const msg = json?.error || `Request failed with status ${res.status}`;
        throw new Error(msg);
      }

      setData(json as DesignerTicketsResponse);
    } catch (err: unknown) {
      console.error("[DesignerBoard] load error", err);
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load designer tickets.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const initial = async () => {
      if (cancelled) return;
      await load();
    };

    initial();

    return () => {
      cancelled = true;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Detail ticket revision history load
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!detailTicketId) {
      setDetailRevisions(null);
      setDetailRevisionsError(null);
      setDetailRevisionsLoading(false);
      return;
    }

    let cancelled = false;

    const loadRevisions = async () => {
      setDetailRevisionsLoading(true);
      setDetailRevisionsError(null);

      try {
        const res = await fetch(
          `/api/designer/tickets/${detailTicketId}/revisions`,
          {
            cache: "no-store",
          },
        );

        const json = await res.json().catch(() => null);

        if (!res.ok) {
          const message =
            (json &&
              typeof json === "object" &&
              "error" in json &&
              (json as any).error) ||
            `Failed to load revision history (status ${res.status}).`;
          if (!cancelled) {
            setDetailRevisionsError(
              typeof message === "string"
                ? message
                : "Failed to load revision history.",
            );
          }
          return;
        }

        const entries = ((json as any)?.revisions ?? []) as TicketRevisionEntry[];
        if (!cancelled) {
          setDetailRevisions(entries);
        }
      } catch (err) {
        console.error(
          "[DesignerBoard] failed to load ticket revision history",
          err,
        );
        if (!cancelled) {
          setDetailRevisionsError(
            "Failed to load revision history. Please try again later.",
          );
        }
      } finally {
        if (!cancelled) {
          setDetailRevisionsLoading(false);
        }
      }
    };

    loadRevisions();

    return () => {
      cancelled = true;
    };
  }, [detailTicketId]);

  // ---------------------------------------------------------------------------
  // Persist status changes
  // ---------------------------------------------------------------------------

  const recomputeStats = (
    tickets: DesignerTicket[],
    prevStats: DesignerTicketsStats,
  ): DesignerTicketsStats => {
    const byStatus: Record<TicketStatus, number> = {
      TODO: 0,
      IN_PROGRESS: 0,
      IN_REVIEW: 0,
      DONE: 0,
    };
    const byPriority: Record<TicketPriority, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      URGENT: 0,
    };

    for (const t of tickets) {
      byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
      byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
    }

    const total = tickets.length;
    const openTotal = total - (byStatus.DONE ?? 0);

    // loadScore’ı backend hesaplıyor; burada değiştirmiyoruz
    const loadScore = prevStats.loadScore;

    return {
      byStatus,
      byPriority,
      total,
      openTotal,
      loadScore,
    };
  };

  const persistTicketStatus = async (
    ticketId: string,
    status: TicketStatus,
  ) => {
    setMutationError(null);
    setUpdatingTicketId(ticketId);
    try {
      const res = await fetch("/api/designer/tickets", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: ticketId,
          status,
        }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("You need to sign in as a designer.");
        }
        if (res.status === 403) {
          throw new Error(
            json?.error ||
              "You do not have permission to update this ticket.",
          );
        }
        const msg = json?.error || `Request failed with status ${res.status}`;
        throw new Error(msg);
      }

      // optimistic update (revision bilgisi değişmeyecek; sadece status)
      setData((prev) => {
        if (!prev) return prev;
        const nextTickets = prev.tickets.map((t) =>
          t.id === ticketId ? { ...t, status } : t,
        );
        return {
          ...prev,
          tickets: nextTickets,
          stats: recomputeStats(nextTickets, prev.stats),
        };
      });
    } catch (err: unknown) {
      console.error("[DesignerBoard] status update error", err);
      const message =
        err instanceof Error
          ? err.message
          : "Failed to update ticket status.";
      setMutationError(message);
      await load();
    } finally {
      setUpdatingTicketId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const tickets = data?.tickets ?? [];
  const stats = data?.stats ?? null;

  const changesRequestedCount = useMemo(
    () => tickets.filter((t) => t.latestRevisionHasFeedback).length,
    [tickets],
  );

  const projects = useMemo(() => {
    const set = new Set<string>();
    tickets.forEach((t) => {
      if (t.project?.name) set.add(t.project.name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (projectFilter !== "ALL" && t.project?.name !== projectFilter) {
        return false;
      }

      if (onlyChangesRequested && !t.latestRevisionHasFeedback) {
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
          t.company?.name ?? "",
          t.project?.name ?? "",
          t.jobType?.name ?? "",
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [tickets, projectFilter, search, onlyChangesRequested]);

  const ticketsByStatus = useMemo(() => {
    const map: Record<TicketStatus, DesignerTicket[]> = {
      TODO: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      DONE: [],
    };

    filteredTickets.forEach((t) => {
      map[t.status].push(t);
    });

    return map;
  }, [filteredTickets]);

  const detailTicket = useMemo(() => {
    if (!detailTicketId) return null;
    return tickets.find((t) => t.id === detailTicketId) ?? null;
  }, [detailTicketId, tickets]);

  // ---------------------------------------------------------------------------
  // Drag & drop rules (designer akışı)
  //
  // Allowed transitions:
  // - TODO → IN_PROGRESS
  // - IN_PROGRESS → IN_REVIEW
  // - IN_REVIEW → IN_PROGRESS
  //
  // Designer:
  // - DONE'a geçiremez
  // - DONE'dan taşıyamaz
  // ---------------------------------------------------------------------------

  type DropDecision = {
    allowed: boolean;
    reason?: string;
  };

  const canDropTicketToStatus = (
    ticket: DesignerTicket,
    targetStatus: TicketStatus,
  ): DropDecision => {
    // Aynı kolona bırakma → serbest (no-op)
    if (ticket.status === targetStatus) {
      return { allowed: true };
    }

    if (ticket.status === "TODO") {
      if (targetStatus === "IN_PROGRESS") {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason:
          "You can only start a backlog ticket by moving it into In progress.",
      };
    }

    if (ticket.status === "IN_PROGRESS") {
      if (targetStatus === "IN_REVIEW") {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason:
          "From In progress you can either keep working here or move the ticket into In review.",
      };
    }

    if (ticket.status === "IN_REVIEW") {
      if (targetStatus === "IN_PROGRESS") {
        return {
          allowed: true,
        };
      }
      return {
        allowed: false,
        reason:
          "From In review you can move the ticket back to In progress if more work is needed.",
      };
    }

    if (ticket.status === "DONE") {
      return {
        allowed: false,
        reason:
          "This request is already completed. The customer controls Done tickets.",
      };
    }

    return {
      allowed: false,
      reason: "This move is not allowed.",
    };
  };

  const handleDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    ticketId: string,
    ticketStatus: TicketStatus,
  ) => {
    // DONE kartları veya şu an update edilen kart draggable değil
    if (ticketStatus === "DONE" || updatingTicketId === ticketId) {
      event.preventDefault();
      return;
    }

    setDraggingTicketId(ticketId);
    setMutationError(null);
    setMouseDownInfo(null);

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
    if (!draggingTicketId) return;

    const ticket = tickets.find((t) => t.id === draggingTicketId);
    if (!ticket) return;

    const decision = canDropTicketToStatus(ticket, status);
    if (!decision.allowed) return;

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

    if (!draggingTicketId) {
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

    // Aynı kolon → no-op
    if (ticket.status === status) {
      return;
    }

    await persistTicketStatus(ticket.id, status);
  };

  // ---------------------------------------------------------------------------
  // Detail modal
  // ---------------------------------------------------------------------------

  const closeTicketDetails = () => {
    setDetailTicketId(null);
    setDetailRevisions(null);
    setDetailRevisionsError(null);
    setDetailRevisionsLoading(false);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const activeProjectTitle =
    projectFilter === "ALL" ? "All projects" : projectFilter;

  return (
    <div className="min-h-screen bg-[#f5f3f0] text-[#424143]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <DesignerNav />

        <div className="mt-4 mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b1afa9]">
              Designer board
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">
              {activeProjectTitle}
            </h1>
            <p className="mt-1 text-xs text-[#7a7a7a]">
              Drag tickets as you work. Move requests from{" "}
              <span className="font-semibold">Backlog</span> into{" "}
              <span className="font-semibold">In progress</span>, then send them
              to <span className="font-semibold">In review</span> when
              you&apos;re ready for your customer to take a look. When they send
              a ticket back with changes, you&apos;ll see a revision badge and a
              short note here or filter by those requests.
            </p>
          </div>
          {loading && (
            <div className="rounded-full bg-[#f5f3f0] px-3 py-1 text-[11px] text-[#7a7a7a]">
              Loading tickets…
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-[#fff7f7] px-4 py-3 text-xs text-red-700">
            <p className="font-medium">Something went wrong</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {mutationError && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-[#fffaf2] px-4 py-3 text-xs text-amber-800">
            {mutationError}
          </div>
        )}

        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by title, ticket code, project or company"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-full border border-[#e3e1dc] bg-[#f7f5f0] px-4 pb-2 pt-2 text-xs text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#7a7a7a]">
            <span>Project:</span>
            <select
              className="rounded-full border border-[#e3e1dc] bg-[#f7f5f0] px-2 py-1 text-[11px] outline-none"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
            >
              <option value="ALL">All</option>
              {projects.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() =>
                setOnlyChangesRequested((prev: boolean) => !prev)
              }
              className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] transition-colors ${
                onlyChangesRequested
                  ? "border-[#f15b2b] bg-[#fff0ea] text-[#d6471b]"
                  : "border-[#e3e1dc] bg-[#f7f5f0] text-[#7a7a7a] hover:border-[#f15b2b]/60"
              }`}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#f5a623]" />
              Changes requested
              <span className="rounded-full bg-black/5 px-1 text-[10px] font-semibold">
                {changesRequestedCount}
              </span>
            </button>
          </div>
        </div>

        {/* Stats küçük header */}
        {stats && (
          <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-[#7a7a7a]">
            <div className="rounded-full bg-[#f5f3f0] px-3 py-1">
              Total: <span className="font-semibold">{stats.total}</span>
            </div>
            <div className="rounded-full bg-[#f5f3f0] px-3 py-1">
              Open: <span className="font-semibold">{stats.openTotal}</span>
            </div>
            <div className="rounded-full bg-[#f5f3f0] px-3 py-1">
              Load score:{" "}
              <span className="font-semibold">{stats.loadScore}</span>
            </div>
            <div className="rounded-full bg-[#f5f3f0] px-3 py-1">
              Changes requested:{" "}
              <span className="font-semibold">{changesRequestedCount}</span>
            </div>
          </div>
        )}

        {/* Columns */}
        <div className="grid gap-3 md:grid-cols-4">
          {STATUS_ORDER.map((status) => {
            const columnTickets = ticketsByStatus[status] ?? [];
            const columnTitle = STATUS_LABELS[status];
            const isActiveDrop = dragOverStatus === status && !!draggingTicketId;

            return (
              <div
                key={status}
                className={`flex flex-col rounded-2xl bg-white/60 p-2 ${
                  isActiveDrop ? "ring-2 ring-[#f15b2b]" : "ring-0"
                }`}
                onDragOver={(event) => handleColumnDragOver(event, status)}
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
                  {status === "DONE" && (
                    <p className="mt-1 text-[10px] text-[#b1afa9]">
                      Completed by customer. You can&apos;t move Done tickets
                      from here.
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

                      const isUpdating = updatingTicketId === t.id;
                      const canDrag = t.status !== "DONE" && !isUpdating;

                      const payoutTokens =
                        t.jobType?.designerPayoutTokens ??
                        t.jobType?.tokenCost ??
                        null;

                      const showRevisionBadge = t.revisionCount > 0;
                      const showFeedbackBadge = t.latestRevisionHasFeedback;

                      return (
                        <div
                          key={t.id}
                          className={`cursor-pointer rounded-xl bg-white p-3 shadow-sm ${
                            isUpdating ? "opacity-60" : ""
                          }`}
                          draggable={canDrag}
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
                            const distance = Math.sqrt(dx * dx + dy * dy);
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
                            <div className="flex items-center gap-1">
                              {showRevisionBadge && (
                                <span className="rounded-full bg-[#edf2ff] px-2 py-0.5 text-[10px] font-medium text-[#3b5bdb]">
                                  v{t.revisionCount}
                                </span>
                              )}
                              <div className="text-[10px] text-[#9a9892]">
                                {t.company?.name || "—"}
                              </div>
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
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${priorityPillClass(
                                t.priority,
                              )}`}
                            >
                              {formatPriorityLabel(t.priority)}
                            </span>
                            {t.project && (
                              <span className="rounded-full bg-[#f5f3f0] px-2 py-0.5 text-[10px] text-[#7a7a7a]">
                                {t.project.name}
                              </span>
                            )}
                            {payoutTokens != null && (
                              <span className="rounded-full bg-[#f0fff6] px-2 py-0.5 text-[10px] text-[#137a3a]">
                                {payoutTokens} tokens
                              </span>
                            )}
                            {showFeedbackBadge && (
                              <span className="rounded-full bg-[#fff7e0] px-2 py-0.5 text-[10px] text-[#8a6b1f]">
                                Changes requested
                              </span>
                            )}
                          </div>
                          {t.latestRevisionHasFeedback &&
                            t.latestRevisionFeedbackSnippet && (
                              <p className="mt-1 line-clamp-2 text-[10px] text-[#7a7a7a]">
                                “{t.latestRevisionFeedbackSnippet}”
                              </p>
                            )}
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
                    {STATUS_LABELS[detailTicket.status]}
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
                <p className="font-semibold text-[#424143]">Company</p>
                <div className="mt-1 space-y-1">
                  <p>
                    Company:{" "}
                    <span className="font-semibold">
                      {detailTicket.company?.name || "—"}
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

              <div>
                <p className="font-semibold text-[#424143]">Revision history</p>
                <div className="mt-1 space-y-1">
                  {detailRevisionsLoading && (
                    <p className="text-[#9a9892]">Loading revision history…</p>
                  )}

                  {!detailRevisionsLoading && detailRevisionsError && (
                    <p className="text-[#b13832]">{detailRevisionsError}</p>
                  )}

                  {!detailRevisionsLoading &&
                    !detailRevisionsError &&
                    (!detailRevisions || detailRevisions.length === 0) && (
                      <p className="text-[#9a9892]">
                        No revisions yet. Once you send this ticket for review
                        and your customer requests changes, you&apos;ll see each
                        version and their feedback here.
                      </p>
                    )}

                  {!detailRevisionsLoading &&
                    !detailRevisionsError &&
                    detailRevisions &&
                    detailRevisions.length > 0 && (
                      <div className="space-y-2">
                        {detailRevisions.map((rev) => (
                          <div
                            key={rev.version}
                            className="rounded-xl bg-[#f5f3f0] px-3 py-2"
                          >
                            <p className="text-[10px] font-semibold text-[#424143]">
                              Version v{rev.version}
                            </p>

                            {rev.submittedAt && (
                              <p className="mt-1">
                                Sent for review on{" "}
                                <span className="font-semibold">
                                  {formatDate(rev.submittedAt)}
                                </span>
                                .
                              </p>
                            )}

                            {rev.feedbackAt && (
                              <p className="mt-1">
                                Customer requested changes on{" "}
                                <span className="font-semibold">
                                  {formatDate(rev.feedbackAt)}
                                </span>
                                .
                              </p>
                            )}

                            {rev.feedbackMessage && (
                              <p className="mt-1 italic text-[#5a5953]">
                                “{rev.feedbackMessage}”
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
