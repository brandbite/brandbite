// -----------------------------------------------------------------------------
// @file: app/customer/tickets/page.tsx
// @purpose: Customer-facing tickets list for a single company (session-based)
// @version: v1.3.0
// @status: active
// @lastUpdate: 2025-11-22
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import type { CompanyRole as CompanyRoleString } from "@/lib/permissions/companyRoles";
import { canCreateTickets } from "@/lib/permissions/companyRoles";
import { CustomerNav } from "@/components/navigation/customer-nav";

type TicketStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type CustomerTicket = {
  id: string;
  code: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  projectName: string | null;
  projectCode: string | null;
  designerName: string | null;
  jobTypeName: string | null;
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
  const [company, setCompany] =
    useState<CustomerTicketsResponse["company"]>();
  const [tickets, setTickets] = useState<CustomerTicket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | TicketStatus>(
    "ALL",
  );
  const [projectFilter, setProjectFilter] = useState<string>("ALL");

  const [companyRole, setCompanyRole] =
    useState<CompanyRoleString | null>(null);
  const [companyRoleLoading, setCompanyRoleLoading] =
    useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/customer/tickets", {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          const msg =
            json?.error || `Request failed with status ${res.status}`;
          throw new Error(msg);
        }

        if (cancelled) return;

        const data = json as CustomerTicketsResponse;
        setCompany(data.company);
        setTickets(data.tickets);
      } catch (err: any) {
        console.error("Customer tickets fetch error:", err);
        if (!cancelled) {
          setError(err?.message || "Failed to load tickets.");
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
          const role = json?.user?.companyRole ?? null;
          if (
            role === "OWNER" ||
            role === "PM" ||
            role === "BILLING" ||
            role === "MEMBER"
          ) {
            setCompanyRole(role);
          } else {
            setCompanyRole(null);
          }
        }
      } catch (err) {
        console.error(
          "[CustomerTicketsPage] Failed to load company role from settings endpoint",
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

  const projects = useMemo(() => {
    const names = Array.from(
      new Set(
        tickets
          .map((t) => t.projectName)
          .filter((p): p is string => !!p),
      ),
    );
    names.sort((a, b) => a.localeCompare(b));
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

      const q = search.trim().toLowerCase();
      if (!q) return true;

      const haystack = [
        t.code,
        t.title,
        t.projectName ?? "",
        t.designerName ?? "",
        t.jobTypeName ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [tickets, statusFilter, projectFilter, search]);

  const canCreateNewTicket = companyRoleLoading
    ? false
    : canCreateTickets(companyRole);

  const formatDate = (iso: string | null) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleDateString();
  };

  const formatStatusLabel = (status: TicketStatus) =>
    STATUS_LABELS[status];

  const formatPriorityLabel = (priority: TicketPriority) => {
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

  return (
    <div className="min-h-screen bg-[#f5f3f0] text-[#424143]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Top navigation */}
        <CustomerNav />

        {/* Page header */}
        <div className="mb-4 mt-2 flex flex-wrap items-center justify-between gap-4">
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

          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              disabled={!canCreateNewTicket}
              className={`inline-flex items-center justify-center rounded-full px-4 py-1.5 text-[11px] font-medium ${
                canCreateNewTicket
                  ? "bg-[#f15b2b] text-white hover:bg-[#e14e22]"
                  : "cursor-not-allowed bg-[#f0eee9] text-[#b8b7b1]"
              }`}
              onClick={() => {
                if (!canCreateNewTicket) return;
                window.location.href = "/customer/tickets/new";
              }}
            >
              New ticket
            </button>

            {!loading && (
              <div className="rounded-full bg-[#f5f3f0] px-3 py-1 text-xs text-[#7a7a7a]">
                {filteredTickets.length} ticket
                {filteredTickets.length === 1 ? "" : "s"} shown
              </div>
            )}
          </div>
        </div>

        {/* Limited access for billing role */}
        {!error &&
          !companyRoleLoading &&
          companyRole === "BILLING" && (
            <div className="mb-4 rounded-xl border border-[#f6c89f] bg-[#fff4e6] px-4 py-3 text-xs text-[#7a7a7a]">
              <p className="text-[11px] font-medium text-[#9a5b2b]">
                Limited access
              </p>
              <p className="mt-1">
                You can review existing tickets, but only your company owner
                or project manager can create new tickets for this workspace.
              </p>
            </div>
          )}

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-red-700">
            <p className="font-medium">Error</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {/* Filters */}
        <section className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <label className="block text-xs font-medium text-[#424143]">
              Search
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ticket, project, designer..."
              className="mt-1 w-full rounded-md border border-[#d4d2cc] bg-[#fbf8f4] px-3 py-2 text-xs text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-[#424143]">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as "ALL" | TicketStatus)
                }
                className="rounded-md border border-[#d4d2cc] bg-[#fbf8f4] px-2 py-1 text-xs text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
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
                className="rounded-md border border-[#d4d2cc] bg-[#fbf8f4] px-2 py-1 text-xs text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
              >
                <option value="ALL">All projects</option>
                {projects.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Tickets table */}
        {!loading && filteredTickets.length === 0 && !error && (
          <section className="rounded-2xl border border-[#e3e1dc] bg-white px-4 py-6 text-sm text-[#7a7a7a]">
            No tickets found for this filter.
          </section>
        )}

        {!loading && filteredTickets.length > 0 && (
          <section className="rounded-2xl border border-[#e3e1dc] bg-white px-4 py-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight">
                Tickets
              </h2>
              <p className="text-xs text-[#9a9892]">
                Showing {filteredTickets.length} of {tickets.length} tickets.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#ebe7df] text-[11px] uppercase tracking-[0.12em] text-[#9a9892]">
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
                        <button
                          type="button"
                          onClick={() =>
                            (window.location.href =
                              `/customer/tickets/${t.id}`)
                          }
                          className="mt-1 inline-flex items-center gap-1 text-[11px] text-[#f15b2b] hover:underline"
                        >
                          <span>View details</span>
                          <span aria-hidden>↗</span>
                        </button>
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
                        <span className="inline-flex rounded-full bg-[#f5f3f0] px-2 py-0.5 text-[11px] font-medium text-[#424143]">
                          {formatStatusLabel(t.status)}
                        </span>
                      </td>
                      <td className="px-2 py-2 align-top">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIORITY_BADGE[t.priority]}`}
                        >
                          {formatPriorityLabel(t.priority)}
                        </span>
                      </td>
                      <td className="px-2 py-2 align-top">
                        <div className="text-[11px] text-[#424143]">
                          {t.designerName ?? "-"}
                        </div>
                      </td>
                      <td className="px-2 py-2 align-top">
                        <div className="text-[11px] text-[#424143]">
                          {t.jobTypeName ?? "-"}
                        </div>
                      </td>
                      <td className="px-2 py-2 align-top">
                        <div className="text-[11px] text-[#7a7a7a]">
                          {formatDate(t.createdAt)}
                        </div>
                      </td>
                      <td className="px-2 py-2 align-top">
                        <div className="text-[11px] text-[#7a7a7a]">
                          {formatDate(t.dueDate)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {loading && (
          <section className="rounded-2xl border border-[#e3e1dc] bg-white px-4 py-6 text-sm text-[#7a7a7a]">
            Loading tickets…
          </section>
        )}
      </div>
    </div>
  );
}
