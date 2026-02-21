// -----------------------------------------------------------------------------
// @file: app/board/page.tsx
// @purpose: Main tickets board (kanban view) for Brandbite
// @version: v1.1.0
// @lastUpdate: 2025-11-14
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";

type TicketStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type TicketCard = {
  id: string;
  code: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  projectName?: string | null;
  companyName?: string | null;
  creativeName?: string | null;
  tokenCost?: number | null;
  createdAt: string;
};

type BoardTicketsResponse = {
  tickets: TicketCard[];
};

const STATUS_COLUMNS: { id: TicketStatus; label: string }[] = [
  { id: "TODO",        label: "To do" },
  { id: "IN_PROGRESS", label: "In progress" },
  { id: "IN_REVIEW",   label: "In review" },
  { id: "DONE",        label: "Done" },
];

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  LOW: "bg-[var(--bb-bg-card)] text-[var(--bb-text-secondary)]",
  MEDIUM: "bg-[var(--bb-info-bg)] text-[var(--bb-info-text)]",
  HIGH: "bg-[var(--bb-warning-bg)] text-[var(--bb-warning-text)]",
  URGENT: "bg-[var(--bb-danger-bg)] text-[var(--bb-danger-text)]",
};

export default function BoardPage() {
  const [tickets, setTickets] = useState<TicketCard[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState<string>("");
  const [projectFilter, setProjectFilter] = useState<string>("ALL");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/board/tickets");
        if (!res.ok) {
          throw new Error(`Request failed with ${res.status}`);
        }

        const json: BoardTicketsResponse = await res.json();
        if (!cancelled) {
          setTickets(json.tickets);
        }
      } catch (err: any) {
        console.error("Board tickets fetch error:", err);
        if (!cancelled) {
          setError(err.message || "Unknown error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const projects = useMemo(() => {
    const names = Array.from(
      new Set(tickets.map((t) => t.projectName).filter(Boolean))
    ) as string[];
    return names;
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (projectFilter !== "ALL" && t.projectName !== projectFilter) {
        return false;
      }

      if (!search.trim()) return true;

      const needle = search.toLowerCase();
      const haystack = [
        t.code,
        t.title,
        t.projectName,
        t.companyName,
        t.creativeName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [tickets, search, projectFilter]);

  const ticketsByStatus = useMemo(() => {
    const map: Record<TicketStatus, TicketCard[]> = {
      TODO: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      DONE: [],
    };
    for (const ticket of filteredTickets) {
      map[ticket.status].push(ticket);
    }
    return map;
  }, [filteredTickets]);

  return (
    <div className="min-h-screen bg-[var(--bb-bg-card)] text-[var(--bb-secondary)]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Top navigation (Brandbite style) */}
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bb-primary)] text-sm font-semibold text-white">
              B
            </div>
            <span className="text-lg font-semibold tracking-tight">
              Brandbite
            </span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-[var(--bb-text-secondary)] md:flex">
            <button className="font-medium text-[var(--bb-secondary)]">Board</button>
            <button className="font-medium text-[var(--bb-text-secondary)]">Creatives</button>
            <button className="font-medium text-[var(--bb-text-secondary)]">Tokens</button>
          </nav>
        </header>

        {/* Page header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Tickets board
            </h1>
            <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
              Visual overview of all active creative requests. This view is now
              powered by real Ticket records from the database.
            </p>
          </div>
        </div>

        {/* Error / empty states */}
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-[var(--bb-bg-page)] px-4 py-3 text-sm text-red-700">
            <p className="font-medium">Error</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {/* Filters */}
        <section className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
          <div className="flex flex-1 items-center gap-2">
            <label className="text-xs font-medium text-[var(--bb-secondary)]">
              Search
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ticket, project, company, creative..."
              className="w-full rounded-md border border-[var(--bb-border-input)] bg-[var(--bb-bg-page)] px-3 py-2 text-sm text-[var(--bb-secondary)] outline-none focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)]"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[var(--bb-secondary)]">
              Project
            </label>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="rounded-md border border-[var(--bb-border-input)] bg-[var(--bb-bg-page)] px-3 py-2 text-sm text-[var(--bb-secondary)] outline-none focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)]"
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

        {/* Loading state */}
        {loading && (
          <div className="rounded-2xl border border-dashed border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-6 text-sm text-[var(--bb-text-secondary)]">
            Loading board tickets…
          </div>
        )}

        {/* Board frame */}
        {!loading && (
          <section
            className="
              board-frame
              mt-4 flex gap-4 overflow-x-auto rounded-2xl border border-[var(--bb-border)]
              bg-[var(--bb-bg-warm)] px-4 py-4 shadow-sm
            "
          >
            {STATUS_COLUMNS.map((column) => {
              const columnTickets = ticketsByStatus[column.id];

              return (
                <div
                  key={column.id}
                  className="flex min-w-[250px] max-w-xs flex-1 flex-col"
                >
                  {/* Column header */}
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--bb-text-tertiary)]">
                        {column.label}
                      </h2>
                      <p className="text-xs text-[var(--bb-text-muted)]">
                        {columnTickets.length} item
                        {columnTickets.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--bb-bg-card)] text-[11px] text-[var(--bb-text-secondary)]">
                      {column.label[0]}
                    </div>
                  </div>

                  {/* Column body */}
                  <div className="flex min-h-[320px] flex-1 flex-col gap-3 rounded-2xl bg-[var(--bb-bg-page)] p-3">
                    {columnTickets.length === 0 ? (
                      <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[var(--bb-border)] bg-[var(--bb-bg-page)]/60 px-3 py-4 text-center text-xs text-[var(--bb-text-muted)]">
                        No tickets in this column.
                      </div>
                    ) : (
                      columnTickets.map((ticket) => (
                        <article
                          key={ticket.id}
                          className="group rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-3 py-3 text-xs shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
                        >
                          <header className="mb-2 flex items-start justify-between gap-2">
                            <div>
                              <div className="text-[11px] font-medium text-[var(--bb-text-secondary)]">
                                {ticket.code}
                              </div>
                              <h3 className="mt-0.5 text-[13px] font-semibold leading-snug text-[var(--bb-secondary)]">
                                {ticket.title}
                              </h3>
                            </div>
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                PRIORITY_COLORS[ticket.priority]
                              }`}
                            >
                              {ticket.priority.toLowerCase()}
                            </span>
                          </header>

                          <div className="mb-2 space-y-1 text-[11px] text-[var(--bb-text-secondary)]">
                            {ticket.projectName && (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] uppercase tracking-wide text-[var(--bb-text-muted)]">
                                  Project
                                </span>
                                <span className="font-medium text-[var(--bb-secondary)]">
                                  {ticket.projectName}
                                </span>
                              </div>
                            )}
                            {ticket.companyName && (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] uppercase tracking-wide text-[var(--bb-text-muted)]">
                                  Company
                                </span>
                                <span>{ticket.companyName}</span>
                              </div>
                            )}
                            {ticket.creativeName && (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] uppercase tracking-wide text-[var(--bb-text-muted)]">
                                  Creative
                                </span>
                                <span>{ticket.creativeName}</span>
                              </div>
                            )}
                          </div>

                          <footer className="flex items-center justify-between pt-1 text-[10px] text-[var(--bb-text-tertiary)]">
                            <div className="flex items-center gap-2">
                              {ticket.tokenCost != null && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bb-bg-card)] px-2 py-0.5 font-medium text-[var(--bb-secondary)]">
                                  <span className="text-[9px]">Tokens</span>
                                  <span className="text-[11px]">
                                    {ticket.tokenCost}
                                  </span>
                                </span>
                              )}
                            </div>
                            <span>
                              {new Date(ticket.createdAt).toLocaleDateString()}
                            </span>
                          </footer>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
