// -----------------------------------------------------------------------------
// @file: app/customer/tickets/page.tsx
// @purpose: Customer-facing tickets list for a single company
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-14
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";

type TicketStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type CustomerTicket = {
  id: string;
  code: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  projectName?: string | null;
  projectCode?: string | null;
  designerName?: string | null;
  jobTypeName?: string | null;
  createdAt: string;
  dueDate: string | null;
};

type CustomerTicketsResponse = {
  company: {
    id: string;
    name: string;
    slug: string;
  };
  tickets: CustomerTicket[];
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  DONE: "Done",
};

const PRIORITY_BADGE: Record<TicketPriority, string> = {
  LOW: "bg-[#f2f1ed] text-[#7a7a7a]",
  MEDIUM: "bg-[#e1f0ff] text-[#245c9b]",
  HIGH: "bg-[#fff5dd] text-[#8a6000]",
  URGENT: "bg-[#fde8e7] text-[#b13832]",
};

export default function CustomerTicketsPage() {
  const [company, setCompany] = useState<CustomerTicketsResponse["company"]>();
  const [tickets, setTickets] = useState<CustomerTicket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | TicketStatus>("ALL");
  const [projectFilter, setProjectFilter] = useState<string>("ALL");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        // NOTE: companySlug is hard-coded for now (demo data).
        // Once auth is in place, this will use the user's active company.
        const res = await fetch("/api/customer/tickets?companySlug=acme-studio");
        if (!res.ok) {
          throw new Error(`Request failed with ${res.status}`);
        }

        const json: CustomerTicketsResponse = await res.json();
        if (!cancelled) {
          setCompany(json.company);
          setTickets(json.tickets);
        }
      } catch (err: any) {
        console.error("Customer tickets fetch error:", err);
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
      if (statusFilter !== "ALL" && t.status !== statusFilter) {
        return false;
      }

      if (projectFilter !== "ALL" && t.projectName !== projectFilter) {
        return false;
      }

      if (!search.trim()) return true;

      const needle = search.toLowerCase();
      const haystack = [
        t.code,
        t.title,
        t.projectName,
        t.designerName,
        t.jobTypeName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [tickets, statusFilter, projectFilter, search]);

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
            <button className="font-medium text-[#7a7a7a]">Board</button>
            <button className="font-medium text-[#424143]">My tickets</button>
            <button className="font-medium text-[#7a7a7a]">Tokens</button>
          </nav>
        </header>

        {/* Page header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              My tickets
            </h1>
            <p className="mt-1 text-sm text-[#7a7a7a]">
              All design requests created for your company, with project,
              status, and designer information.
            </p>
            {company && (
              <p className="mt-1 text-xs text-[#9a9892]">
                Company:{" "}
                <span className="font-medium text-[#424143]">
                  {company.name}
                </span>{" "}
                ({company.slug})
              </p>
            )}
          </div>
        </div>

        {/* Error */}
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
              placeholder="Search by ticket, project, designer..."
              className="w-full rounded-md border border-[#d4d2cc] bg-[#fbfaf8] px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[#424143]">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "ALL" | TicketStatus)
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

        {/* Loading state */}
        {loading && (
          <div className="rounded-2xl border border-dashed border-[#e3e1dc] bg-white px-5 py-6 text-sm text-[#7a7a7a]">
            Loading tickets…
          </div>
        )}

        {/* Tickets table */}
        {!loading && (
          <section className="mt-4 rounded-2xl border border-[#e3e1dc] bg-white px-4 py-4 shadow-sm">
            {filteredTickets.length === 0 ? (
              <div className="py-8 text-center text-sm text-[#9a9892]">
                No tickets match your filters yet.
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
                      <th className="px-2 py-2">Designer</th>
                      <th className="px-2 py-2">Job type</th>
                      <th className="px-2 py-2">Created</th>
                      <th className="px-2 py-2">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTickets.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b border-[#f0eeea] text-xs last:border-b-0"
                      >
                        <td className="px-2 py-2 align-top">
                          <div className="font-medium text-[#424143]">
                            {t.code}
                          </div>
                          <div className="text-[11px] text-[#7a7a7a]">
                            {t.title}
                          </div>
                        </td>
                        <td className="px-2 py-2 align-top">
                          <div className="text-[11px] font-medium text-[#424143]">
                            {t.projectName ?? "-"}
                          </div>
                          {t.projectCode && (
                            <div className="text-[11px] text-[#9a9892]">
                              {t.projectCode}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2 align-top">
                          <span className="inline-flex rounded-full bg-[#f2f1ed] px-2 py-0.5 text-[11px] font-medium text-[#424143]">
                            {STATUS_LABELS[t.status]}
                          </span>
                        </td>
                        <td className="px-2 py-2 align-top">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              PRIORITY_BADGE[t.priority]
                            }`}
                          >
                            {t.priority.toLowerCase()}
                          </span>
                        </td>
                        <td className="px-2 py-2 align-top text-[11px] text-[#424143]">
                          {t.designerName ?? "-"}
                        </td>
                        <td className="px-2 py-2 align-top text-[11px] text-[#424143]">
                          {t.jobTypeName ?? "-"}
                        </td>
                        <td className="px-2 py-2 align-top text-[11px] text-[#9a9892]">
                          {new Date(t.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-2 py-2 align-top text-[11px] text-[#9a9892]">
                          {t.dueDate
                            ? new Date(t.dueDate).toLocaleDateString()
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
