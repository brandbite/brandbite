// -----------------------------------------------------------------------------
// @file: app/creative/tickets/page.tsx
// @purpose: Creative-facing ticket board (list + status updates, clients mark DONE)
// @version: v1.2.0
// @status: active
// @lastUpdate: 2025-11-18
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  ButtonLink,
  Callout,
  Card,
  DASH,
  EmptyState,
  fmt,
  PageHeader,
  plural,
  SearchInput,
  Select,
  Skeleton,
  Table,
  TableFooter,
  Td,
  Th,
  TICKET_STATUS,
} from "@/components/admin/v2/ui";
import {
  DueDate,
  PriorityBadge,
  SortableTh,
  StatusBadge,
  TicketViewToggle,
  tokenCount,
} from "@/components/dashboard/tickets/shared";
import { buildTicketCode } from "@/lib/ticket-code";
import { fetchAllTickets } from "@/lib/fetch-all-tickets";
import { allowedCreativeTargets } from "@/lib/tickets/creative-transitions";
import { useToast } from "@/components/ui/toast-provider";
import { STATUS_ORDER, PRIORITY_ORDER } from "@/lib/board";

type TicketStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type CreativeTicket = {
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
    creativePayoutTokens: number;
  } | null;
  latestRevisionHasFeedback: boolean;
  /** Payout at this creative's current rate; the same figure the board shows. */
  estimatedPayout: number | null;
};

const STATUS_CARDS: { value: "ALL" | TicketStatus; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "TODO", label: "Backlog" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "IN_REVIEW", label: "In review" },
  { value: "DONE", label: "Done" },
];

/**
 * The current status plus the moves a creative may make from it (shared rule,
 * lib/tickets/creative-transitions). In review is left out as a target:
 * sending work belongs on the Board's Upload work step, which attaches files.
 */
function tableStatusOptions(current: TicketStatus): string[] {
  const targets = allowedCreativeTargets(current).filter((s) => s !== "IN_REVIEW" && s !== "DONE");
  return [current, ...targets];
}

type CreativeTicketsResponse = {
  stats: {
    byStatus: Record<TicketStatus, number>;
    total: number;
  };
  tickets: CreativeTicket[];
};

export default function CreativeTicketsPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [data, setData] = useState<CreativeTicketsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<"ALL" | TicketStatus>("ALL");
  const [projectFilter, setProjectFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      // All pages — this table has no paging of its own, and the API returns
      // 50 per page by default.
      const json = await fetchAllTickets<CreativeTicketsResponse>("/api/creative/tickets").catch(
        (err: Error & { status?: number }) => {
          if (err.status === 401) {
            throw new Error("You must be signed in as a creative to view this page.");
          }
          if (err.status === 403) {
            throw new Error("You do not have permission to view creative tickets.");
          }
          throw err;
        },
      );
      setData(json);
    } catch (err: unknown) {
      console.error("Creative tickets fetch error:", err);
      const message = err instanceof Error ? err.message : "Failed to load creative tickets.";
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
  }, []);

  const tickets = data?.tickets ?? [];

  const projects = useMemo(() => {
    const list = Array.from(
      new Set(tickets.map((t) => t.project?.name).filter((p): p is string => !!p)),
    );
    return list;
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter !== "ALL" && t.status !== statusFilter) {
        return false;
      }
      if (projectFilter !== "ALL" && t.project?.name !== projectFilter) {
        return false;
      }
      if (query) {
        const code = buildTicketCode({
          projectCode: t.project?.code,
          companyTicketNumber: t.companyTicketNumber,
          ticketId: t.id,
        });
        const haystack = [code, t.title, t.project?.name, t.company?.name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [tickets, statusFilter, projectFilter, search]);

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
          cmp = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
          break;
        case "priority":
          cmp = PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);
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

  const handleStatusChange = async (ticketId: string, newStatus: TicketStatus) => {
    setUpdatingId(ticketId);
    setError(null);

    try {
      const res = await fetch("/api/creative/tickets", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: ticketId, status: newStatus }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = json?.error || `Request failed with status ${res.status}`;
        throw new Error(msg);
      }

      showToast({ type: "success", title: "Ticket status updated." });
      await load();
    } catch (err: unknown) {
      console.error("Creative ticket update error:", err);
      const message =
        err instanceof Error ? err.message : "Failed to update ticket. Please try again.";
      setError(message);
      showToast({ type: "error", title: message });
    } finally {
      setUpdatingId(null);
    }
  };

  const isUpdating = (id: string) => updatingId === id;
  const sortDirection = (field: SortField) => (sortField === field ? sortDir : null);
  const stats = data?.stats ?? null;
  const anyFilterActive = statusFilter !== "ALL" || projectFilter !== "ALL" || search.trim() !== "";

  return (
    <>
      <PageHeader
        title="My jobs"
        description="Send work for review from the job. Clients approve completion, which triggers your payout."
      />

      <div className="space-y-4">
        <TicketViewToggle rolePath="/creative" />

        {error ? (
          <Callout tone="error" title="Something went wrong">
            {error}
          </Callout>
        ) : null}

        <div
          role="group"
          aria-label="Filter by status"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"
        >
          {STATUS_CARDS.map((card) => {
            const count =
              loading || !stats
                ? null
                : card.value === "ALL"
                  ? stats.total
                  : stats.byStatus[card.value];
            const active = statusFilter === card.value;
            return (
              <button
                key={card.value}
                type="button"
                aria-pressed={active}
                onClick={() => setStatusFilter(card.value)}
                className={`rounded-2xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:ring-offset-1 focus-visible:outline-none ${
                  active
                    ? "border-[var(--av2-accent)] bg-[var(--av2-selected)]"
                    : "border-[var(--av2-border)] bg-[var(--av2-surface)] hover:bg-[var(--av2-bg)]"
                }`}
              >
                <span className="block text-sm text-[var(--av2-text-2)]">{card.label}</span>
                <span className="mt-1 block text-2xl leading-8 font-bold tabular-nums">
                  {fmt(count)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            label="Search jobs"
            placeholder="Search jobs, project or customer…"
            className="min-w-[240px] flex-1"
          />
          <div className="w-full sm:w-56">
            <Select
              aria-label="Filter by project"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
            >
              <option value="ALL">All projects</option>
              {projects.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {loading ? (
          <div aria-busy="true" aria-label="Loading jobs" className="space-y-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : filteredTickets.length === 0 ? (
          error ? null : (
            <Card>
              {anyFilterActive ? (
                <EmptyState
                  title="No jobs match these filters"
                  description="Try a different status, project or search."
                />
              ) : (
                <EmptyState
                  title="No jobs assigned yet"
                  description="Jobs assigned to you will appear here."
                />
              )}
            </Card>
          )
        ) : (
          <Card padding="none">
            <Table label="Assigned jobs">
              <thead className="max-lg:hidden">
                <tr>
                  <Th>Job</Th>
                  <Th>Project</Th>
                  <SortableTh
                    label="Status"
                    direction={sortDirection("status")}
                    onSort={() => handleSort("status")}
                  />
                  <SortableTh
                    label="Priority"
                    direction={sortDirection("priority")}
                    onSort={() => handleSort("priority")}
                  />
                  <Th>Payout</Th>
                  <SortableTh
                    label="Due"
                    direction={sortDirection("due")}
                    onSort={() => handleSort("due")}
                  />
                  <Th>Action</Th>
                </tr>
              </thead>
              <tbody className="max-lg:block">
                {sortedTickets.map((t) => {
                  const ticketCode = buildTicketCode({
                    projectCode: t.project?.code,
                    companyTicketNumber: t.companyTicketNumber,
                    ticketId: t.id,
                  });
                  const payoutTokens = t.estimatedPayout ?? t.jobType?.creativePayoutTokens ?? null;
                  const options = tableStatusOptions(t.status);

                  return (
                    <tr
                      key={t.id}
                      onClick={() => router.push(`/creative/tickets/${t.id}`)}
                      className="cursor-pointer border-b border-[var(--av2-border)] last:border-b-0 hover:bg-[var(--av2-bg)] max-lg:block max-lg:p-4"
                    >
                      <Td className="max-lg:block max-lg:!p-0">
                        <p className="text-[var(--av2-text-2)]">{ticketCode}</p>
                        <Link
                          href={`/creative/tickets/${t.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold hover:underline"
                        >
                          {t.title}
                        </Link>
                        {t.latestRevisionHasFeedback && t.status !== "DONE" ? (
                          <div className="mt-1">
                            <Badge tone="peach">Changes requested</Badge>
                          </div>
                        ) : null}
                      </Td>
                      <Td className="max-lg:mt-1 max-lg:block max-lg:!p-0">
                        <p>{t.project?.name ?? DASH}</p>
                        {t.company?.name ? (
                          <p className="text-xs text-[var(--av2-text-2)]">{t.company.name}</p>
                        ) : null}
                      </Td>
                      <Td className="max-lg:mt-2 max-lg:inline-block max-lg:!p-0">
                        <StatusBadge status={t.status} />
                      </Td>
                      <Td className="max-lg:mt-2 max-lg:ml-2 max-lg:inline-block max-lg:!p-0">
                        <PriorityBadge priority={t.priority} />
                      </Td>
                      <Td className="whitespace-nowrap max-lg:mt-2 max-lg:block max-lg:!p-0">
                        <span className="text-[var(--av2-text-2)] lg:hidden">Payout: </span>
                        {payoutTokens != null && payoutTokens > 0 ? tokenCount(payoutTokens) : DASH}
                      </Td>
                      <Td className="whitespace-nowrap max-lg:mt-1 max-lg:block max-lg:!p-0">
                        <span className="text-[var(--av2-text-2)] lg:hidden">Due: </span>
                        <DueDate iso={t.dueDate} done={t.status === "DONE"} />
                      </Td>
                      <Td className="max-lg:mt-3 max-lg:block max-lg:!p-0">
                        <div
                          className="flex flex-wrap items-center gap-2 lg:w-[272px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t.status === "DONE" ? null : (
                            <div className="w-36">
                              <Select
                                aria-label={`Change status of ${t.title}`}
                                value={t.status}
                                onChange={(e) =>
                                  handleStatusChange(t.id, e.target.value as TicketStatus)
                                }
                                disabled={isUpdating(t.id) || options.length < 2}
                              >
                                {options.map((s) => (
                                  <option key={s} value={s}>
                                    {TICKET_STATUS[s].label}
                                  </option>
                                ))}
                              </Select>
                            </div>
                          )}
                          <ButtonLink href={`/creative/tickets/${t.id}`} variant="primary">
                            Open job
                          </ButtonLink>
                          {isUpdating(t.id) ? (
                            <p role="status" className="w-full text-xs text-[var(--av2-text-2)]">
                              Updating status…
                            </p>
                          ) : t.status === "DONE" ? (
                            <p className="w-full text-xs text-[var(--av2-text-2)]">
                              This job is done and can't be moved.
                            </p>
                          ) : null}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <TableFooter>
              Showing {filteredTickets.length} of {tickets.length}{" "}
              {plural(tickets.length, "job", "jobs")}
            </TableFooter>
          </Card>
        )}
      </div>
    </>
  );
}
