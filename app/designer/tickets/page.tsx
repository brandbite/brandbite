// -----------------------------------------------------------------------------
// @file: app/designer/tickets/page.tsx
// @purpose: Designer-facing ticket board (list + status updates, clients mark DONE)
// @version: v1.2.0
// @status: active
// @lastUpdate: 2025-11-18
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, THead, TH, TD } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FormSelect } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { useToast } from "@/components/ui/toast-provider";
import { Badge } from "@/components/ui/badge";
import {
  priorityBadgeVariant,
  statusBadgeVariant,
  formatPriorityLabel,
  formatBoardDate,
  STATUS_LABELS,
  STATUS_ORDER,
  PRIORITY_ORDER,
  isDueDateOverdue,
  isDueDateSoon,
} from "@/lib/board";

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
  const router = useRouter();
  const { showToast } = useToast();

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

  // ---------------------------------------------------------------------------
  // Column sorting
  // ---------------------------------------------------------------------------

  type SortField = "status" | "priority" | "due";
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "due" ? "desc" : "asc");
    }
  };

  const sortedTickets = useMemo(() => {
    if (!sortField) return filteredTickets;

    const copy = [...filteredTickets];

    copy.sort((a, b) => {
      let cmp = 0;

      switch (sortField) {
        case "status":
          cmp =
            STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
          break;
        case "priority":
          cmp =
            PRIORITY_ORDER.indexOf(a.priority) -
            PRIORITY_ORDER.indexOf(b.priority);
          break;
        case "due": {
          const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          cmp = aTime - bTime;
          break;
        }
      }

      return sortDir === "asc" ? cmp : -cmp;
    });

    return copy;
  }, [filteredTickets, sortField, sortDir]);

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

      showToast({ type: "success", title: "Ticket status updated." });
      await load();
    } catch (err: unknown) {
      console.error("Designer ticket update error:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Failed to update ticket. Please try again.";
      setError(message);
      showToast({ type: "error", title: message });
    } finally {
      setUpdatingId(null);
    }
  };


  const isUpdating = (id: string) => updatingId === id;

  return (
    <>
      {/* Page header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              My tickets
            </h1>
            <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
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
          <InlineAlert variant="error" title="Error" className="mb-4">
            {error}
          </InlineAlert>
        )}

        {/* Summary cards */}
        <section className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-[var(--bb-border)] bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--bb-text-tertiary)]">
              Total
            </p>
            <p className="mt-2 text-3xl font-semibold text-[var(--bb-secondary)]">
              {loading ? "—" : data ? data.stats.total : 0}
            </p>
            <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
              All tickets assigned to you.
            </p>
          </div>

          {(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as TicketStatus[])
            .map((status) => (
              <div
                key={status}
                className="rounded-2xl border border-[var(--bb-border)] bg-white px-5 py-4 shadow-sm"
              >
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--bb-text-tertiary)]">
                  {STATUS_LABELS[status]}
                </p>
                <p className="mt-2 text-2xl font-semibold text-[var(--bb-secondary)]">
                  {loading
                    ? "—"
                    : data
                    ? data.stats.byStatus[status]
                    : 0}
                </p>
                <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
                  Tickets currently in this state.
                </p>
              </div>
            ))}
        </section>

        {/* Filters */}
        <section className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--bb-border)] bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[var(--bb-secondary)]">
              Status
            </label>
            <FormSelect
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as "ALL" | TicketStatus,
                )
              }
              className="w-auto"
            >
              <option value="ALL">All</option>
              <option value="TODO">To do</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="IN_REVIEW">In review</option>
              <option value="DONE">Done</option>
            </FormSelect>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[var(--bb-secondary)]">
              Project
            </label>
            <FormSelect
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="w-auto"
            >
              <option value="ALL">All projects</option>
              {projects.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </FormSelect>
          </div>
        </section>

        {/* Tickets table */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">
              Assigned tickets
            </h2>
            <p className="text-xs text-[var(--bb-text-tertiary)]">
              Showing {filteredTickets.length} of {tickets.length} tickets.
            </p>
          </div>

          {loading ? (
            <LoadingState message="Loading tickets…" />
          ) : filteredTickets.length === 0 ? (
            <EmptyState title="No tickets match your filters." />
          ) : (
            <DataTable>
              <THead>
                <TH>Ticket</TH>
                <TH>Project</TH>
                <TH
                  sortable
                  sortDirection={sortField === "status" ? sortDir : null}
                  onSort={() => handleSort("status")}
                >
                  Status
                </TH>
                <TH
                  sortable
                  sortDirection={sortField === "priority" ? sortDir : null}
                  onSort={() => handleSort("priority")}
                >
                  Priority
                </TH>
                <TH>Payout</TH>
                <TH
                  sortable
                  sortDirection={sortField === "due" ? sortDir : null}
                  onSort={() => handleSort("due")}
                >
                  Due
                </TH>
                <TH>Actions</TH>
              </THead>
              <tbody>
                {sortedTickets.map((t) => {
                  const statusLabel = STATUS_LABELS[t.status];
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
                      className="border-b border-[var(--bb-border-subtle)] text-xs last:border-b-0 cursor-pointer transition-colors hover:bg-[var(--bb-bg-warm)]"
                      onClick={() =>
                        router.push(
                          `/designer/tickets/${t.id}`,
                        )
                      }
                    >
                      <TD>
                        <div className="font-medium">
                          {ticketCode}
                        </div>
                        <div className="text-xs text-[var(--bb-text-secondary)]">
                          {t.title}
                        </div>
                      </TD>
                      <TD>
                        {t.project ? (
                          <>
                            <div className="font-medium">
                              {t.project.name}
                            </div>
                            <div className="text-xs text-[var(--bb-text-tertiary)]">
                              {t.company?.name}
                            </div>
                          </>
                        ) : (
                          "—"
                        )}
                      </TD>
                      <TD>
                        <Badge variant={statusBadgeVariant(t.status)}>{statusLabel}</Badge>
                      </TD>
                      <TD>
                        <Badge variant={priorityBadgeVariant(t.priority)}>{formatPriorityLabel(t.priority)}</Badge>
                      </TD>
                      <TD>
                        {payoutTokens > 0
                          ? `${payoutTokens} tokens`
                          : "—"}
                      </TD>
                      <TD>
                        {t.dueDate ? (
                          <span
                            className={
                              isDueDateOverdue(t.dueDate)
                                ? "font-semibold text-[var(--bb-danger-text)]"
                                : isDueDateSoon(t.dueDate)
                                  ? "font-semibold text-[var(--bb-warning-text)]"
                                  : ""
                            }
                          >
                            {formatBoardDate(t.dueDate)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TD>
                      <TD onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col gap-2">
                          <FormSelect
                            value={t.status}
                            onChange={(e) =>
                              handleStatusChange(
                                t.id,
                                e.target
                                  .value as TicketStatus,
                              )
                            }
                            disabled={isUpdating(t.id) || t.status === "DONE"}
                            size="sm"
                            className="w-auto"
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
                          </FormSelect>
                          {isUpdating(t.id) && (
                            <span className="text-xs text-[var(--bb-text-tertiary)]">
                              Updating status…
                            </span>
                          )}
                          {t.status === "DONE" && (
                            <span className="text-xs text-[var(--bb-text-tertiary)]">
                              Ticket is done. Only the client can reopen it.
                            </span>
                          )}
                        </div>
                      </TD>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          )}
        </section>
    </>
  );
}
