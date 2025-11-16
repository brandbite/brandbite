// -----------------------------------------------------------------------------
// @file: app/designer/tickets/page.tsx
// @purpose: Designer-facing ticket board (list + status updates, clients mark DONE)
// @version: v1.1.0
// @status: active
// @lastUpdate: 2025-11-16
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";

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
};

type DesignerTicketsResponse = {
  stats: {
    byStatus: Record<TicketStatus, number>;
    total: number;
  };
  tickets: DesignerTicket[];
};

export default function DesignerTicketsPage() {
  const [data, setData] = useState<DesignerTicketsResponse | null>(
    null,
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<
    "ALL" | TicketStatus
  >("ALL");
  const [projectFilter, setProjectFilter] = useState<string>("ALL");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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
          throw new Error(
            "You must be signed in as a designer to view this page.",
          );
        }
        if (res.status === 403) {
          throw new Error(
            "You do not have permission to view designer tickets.",
          );
        }
        const msg =
          json?.error || `Request failed with status ${res.status}`;
        throw new Error(msg);
      }

      setData(json as DesignerTicketsResponse);
    } catch (err: unknown) {
      console.error("Designer tickets fetch error:", err);
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

    const initialLoad = async () => {
      if (cancelled) return;
      await load();
    };

    initialLoad();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (statusFilter !== "ALL" && t.status !== statusFilter) {
        return false;
      }
      if (
        projectFilter !== "ALL" &&
        t.project?.name !== projectFilter
      ) {
        return false;
      }
      return true;
    });
  }, [tickets, statusFilter, projectFilter]);

  const handleStatusChange = async (
    ticketId: string,
    newStatus: TicketStatus,
  ) => {
    setUpdatingId(ticketId);
    setError(null);

    try {
      const res = await fetch("/api/designer/tickets", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: ticketId, status: newStatus }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          json?.error || `Request failed with status ${res.status}`;
        throw new Error(msg);
      }

      await load();
    } catch (err: unknown) {
      console.error("Designer ticket update error:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Failed to update ticket. Please try again.";
      setError(message);
    } finally {
      setUpdatingId(null);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString();
  };

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

  const statusBadgeClass = (status: TicketStatus) => {
    switch (status) {
      case "TODO":
        return "bg-[#f4f1ff] text-[#4a3fb3]";
      case "IN_PROGRESS":
        return "bg-[#e9f6ff] text-[#1d72b8]";
      case "IN_REVIEW":
        return "bg-[#fff7e0] text-[#8a6b1f]";
      case "DONE":
        return "bg-[#f0fff6] text-[#137a3a]";
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

  const isUpdating = (id: string) => updatingId === id;

  return (
    <div className="min-h-screen bg-[#f5f3f0] text-[#424143]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Top navigation */}
        <header className="mb-6 flex items-center justify-between">
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
              onClick={() => (window.location.href = "/designer/balance")}
            >
              Balance
            </button>
            <button
              className="font-medium text-[#7a7a7a]"
              onClick={() =>
                (window.location.href = "/designer/withdrawals")
              }
            >
              Withdrawals
            </button>
            <button className="font-medium text-[#424143]">
              Tickets
            </button>
          </nav>
        </header>

        {/* Page header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              My tickets
            </h1>
            <p className="mt-1 text-sm text-[#7a7a7a]">
              Tickets assigned to you, across all customer projects. You can
              move tickets between{" "}
              <span className="font-medium">To do</span>,{" "}
              <span className="font-medium">In progress</span> and{" "}
              <span className="font-medium">In review</span>. Clients mark
              tickets as <span className="font-medium">Done</span> to trigger
              payouts.
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-red-700">
            <p className="font-medium">Error</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {/* Summary cards */}
        <section className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#9a9892]">
              Total
            </p>
            <p className="mt-2 text-3xl font-semibold text-[#424143]">
              {loading ? "—" : data ? data.stats.total : 0}
            </p>
            <p className="mt-1 text-xs text-[#9a9892]">
              All tickets assigned to you.
            </p>
          </div>

          {(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as TicketStatus[])
            .map((status) => (
              <div
                key={status}
                className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm"
              >
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#9a9892]">
                  {formatStatusLabel(status)}
                </p>
                <p className="mt-2 text-2xl font-semibold text-[#424143]">
                  {loading
                    ? "—"
                    : data
                    ? data.stats.byStatus[status]
                    : 0}
                </p>
                <p className="mt-1 text-xs text-[#9a9892]">
                  Tickets currently in this state.
                </p>
              </div>
            ))}
        </section>

        {/* Filters */}
        <section className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[#424143]">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as "ALL" | TicketStatus,
                )
              }
              className="rounded-md border border-[#d4d2cc] bg-[#fbfaf8] px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
            >
              <option value="ALL">All</option>
              <option value="TODO">To do</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="IN_REVIEW">In review</option>
              <option value="DONE">Done</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[#424143]">
              Project
            </label>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="rounded-md border border-[#d4d2cc] bg-[#fbfaf8] px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
            >
              <option value="ALL">All projects</option>
              {projects.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Tickets table */}
        <section className="rounded-2xl border border-[#e3e1dc] bg-white px-4 py-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">
              Assigned tickets
            </h2>
            <p className="text-xs text-[#9a9892]">
              Showing {filteredTickets.length} of {tickets.length} tickets.
            </p>
          </div>

          {loading ? (
            <div className="py-6 text-center text-sm text-[#7a7a7a]">
              Loading tickets…
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="py-6 text-center text-sm text-[#9a9892]">
              No tickets match your filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#e3e1dc] text-xs uppercase tracking-[0.08em] text-[#9a9892]">
                    <th className="px-2 py-2">Ticket</th>
                    <th className="px-2 py-2">Project</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Priority</th>
                    <th className="px-2 py-2">Payout</th>
                    <th className="px-2 py-2">Due</th>
                    <th className="px-2 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((t) => {
                    const statusLabel = formatStatusLabel(t.status);
                    const ticketCode =
                      t.project?.code && t.companyTicketNumber != null
                        ? `${t.project.code}-${t.companyTicketNumber}`
                        : t.companyTicketNumber != null
                        ? `#${t.companyTicketNumber}`
                        : t.id;

                    const payoutTokens =
                      t.jobType?.designerPayoutTokens ?? 0;

                    return (
                      <tr
                        key={t.id}
                        className="border-b border-[#f0eeea] text-xs last:border-b-0"
                      >
                        <td className="px-2 py-2 align-top text-[11px] text-[#424143]">
                          <div className="font-medium">
                            {ticketCode}
                          </div>
                          <div className="text-[11px] text-[#7a7a7a]">
                            {t.title}
                          </div>
                        </td>
                        <td className="px-2 py-2 align-top text-[11px] text-[#424143]">
                          {t.project ? (
                            <>
                              <div className="font-medium">
                                {t.project.name}
                              </div>
                              <div className="text-[10px] text-[#9a9892]">
                                {t.company?.name}
                              </div>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-2 py-2 align-top text-[11px]">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(
                              t.status,
                            )}`}
                          >
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-2 py-2 align-top text-[11px]">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${priorityBadgeClass(
                              t.priority,
                            )}`}
                          >
                            {t.priority}
                          </span>
                        </td>
                        <td className="px-2 py-2 align-top text-[11px] text-[#424143]">
                          {payoutTokens > 0
                            ? `${payoutTokens} tokens`
                            : "—"}
                        </td>
                        <td className="px-2 py-2 align-top text-[11px] text-[#7a7a7a]">
                          {formatDate(t.dueDate)}
                        </td>
                        <td className="px-2 py-2 align-top text-[11px]">
                          <div className="flex flex-col gap-2">
                            <select
                              value={t.status}
                              onChange={(e) =>
                                handleStatusChange(
                                  t.id,
                                  e.target
                                    .value as TicketStatus,
                                )
                              }
                              disabled={isUpdating(t.id) || t.status === "DONE"}
                              className="rounded-md border border-[#d4d2cc] bg-[#fbfaf8] px-2 py-1 text-[11px] text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
                            >
                              <option value="TODO">
                                To do
                              </option>
                              <option value="IN_PROGRESS">
                                In progress
                              </option>
                              <option value="IN_REVIEW">
                                In review
                              </option>
                              {/* Designers cannot set DONE; clients close tickets */}
                            </select>
                            {isUpdating(t.id) && (
                              <span className="text-[10px] text-[#9a9892]">
                                Updating status…
                              </span>
                            )}
                            {t.status === "DONE" && (
                              <span className="text-[10px] text-[#9a9892]">
                                Ticket is done. Only the client can reopen it.
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
