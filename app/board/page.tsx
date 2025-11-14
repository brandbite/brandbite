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
  designerName?: string | null;
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
  LOW: "bg-[#f2f1ed] text-[#7a7a7a]",
  MEDIUM: "bg-[#e1f0ff] text-[#245c9b]",
  HIGH: "bg-[#fff5dd] text-[#8a6000]",
  URGENT: "bg-[#fde8e7] text-[#b13832]",
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
        t.designerName,
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
    <div className="min-h-screen bg-[#f5f3f0] text-[#424143]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Top navigation (Brandbite style) */}
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
            <button className="font-medium text-[#424143]">Board</button>
            <button className="font-medium text-[#7a7a7a]">Designers</button>
            <button className="font-medium text-[#7a7a7a]">Tokens</button>
          </nav>
        </header>

        {/* Page header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Tickets board
            </h1>
            <p className="mt-1 text-sm text-[#7a7a7a]">
              Visual overview of all active design requests. This view is now
              powered by real Ticket records from the database.
            </p>
          </div>
        </div>

        {/* Error / empty states */}
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-red-700">
            <p className="font-medium">Error</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {/* Filters */}
        <section className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-1 items-center gap-2">
            <label className="text-xs font-medium text-[#424143]">
              Search
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ticket, project, company, designer..."
              className="w-full rounded-md border border-[#d4d2cc] bg-[#fbfaf8] px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
            />
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

        {/* Loading state */}
        {loading && (
          <div className="rounded-2xl border border-dashed border-[#e3e1dc] bg-white px-5 py-6 text-sm text-[#7a7a7a]">
            Loading board tickets…
          </div>
        )}

        {/* Board frame */}
        {!loading && (
          <section
            className="
              board-frame
              mt-4 flex gap-4 overflow-x-auto rounded-2xl border border-[#e3e1dc]
              bg-[#f8f6f3] px-4 py-4 shadow-sm
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
                      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9a9892]">
                        {column.label}
                      </h2>
                      <p className="text-xs text-[#b8b6b1]">
                        {columnTickets.length} item
                        {columnTickets.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f2f1ed] text-[11px] text-[#7a7a7a]">
                      {column.label[0]}
                    </div>
                  </div>

                  {/* Column body */}
                  <div className="flex min-h-[320px] flex-1 flex-col gap-3 rounded-2xl bg-[#fdfbf8] p-3">
                    {columnTickets.length === 0 ? (
                      <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[#e3e1dc] bg-white/60 px-3 py-4 text-center text-xs text-[#b8b6b1]">
                        No tickets in this column.
                      </div>
                    ) : (
                      columnTickets.map((ticket) => (
                        <article
                          key={ticket.id}
                          className="group rounded-xl border border-[#e3e1dc] bg-white px-3 py-3 text-xs shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
                        >
                          <header className="mb-2 flex items-start justify-between gap-2">
                            <div>
                              <div className="text-[11px] font-medium text-[#7a7a7a]">
                                {ticket.code}
                              </div>
                              <h3 className="mt-0.5 text-[13px] font-semibold leading-snug text-[#424143]">
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

                          <div className="mb-2 space-y-1 text-[11px] text-[#7a7a7a]">
                            {ticket.projectName && (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] uppercase tracking-wide text-[#b8b6b1]">
                                  Project
                                </span>
                                <span className="font-medium text-[#424143]">
                                  {ticket.projectName}
                                </span>
                              </div>
                            )}
                            {ticket.companyName && (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] uppercase tracking-wide text-[#b8b6b1]">
                                  Company
                                </span>
                                <span>{ticket.companyName}</span>
                              </div>
                            )}
                            {ticket.designerName && (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] uppercase tracking-wide text-[#b8b6b1]">
                                  Designer
                                </span>
                                <span>{ticket.designerName}</span>
                              </div>
                            )}
                          </div>

                          <footer className="flex items-center justify-between pt-1 text-[10px] text-[#9a9892]">
                            <div className="flex items-center gap-2">
                              {ticket.tokenCost != null && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#f2f1ed] px-2 py-0.5 font-medium text-[#424143]">
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
