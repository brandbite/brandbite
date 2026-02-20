// -----------------------------------------------------------------------------
// @file: app/customer/tickets/page.tsx
// @purpose: Customer-facing tickets list for a single company (session-based)
// @version: v1.3.0
// @status: active
// @lastUpdate: 2025-11-22
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import { DataTable, THead, TH, TD } from "@/components/ui/data-table";
import type { CompanyRole as CompanyRoleString } from "@/lib/permissions/companyRoles";
import { canCreateTickets } from "@/lib/permissions/companyRoles";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { FormInput, FormSelect } from "@/components/ui/form-field";
import { Badge } from "@/components/ui/badge";
import {
  priorityBadgeVariant,
  statusBadgeVariant,
  isDueDateOverdue,
  isDueDateSoon,
  STATUS_ORDER,
  PRIORITY_ORDER,
} from "@/lib/board";


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
  isAssigned: boolean;
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
        t.jobTypeName ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [tickets, statusFilter, projectFilter, search]);

  // ---------------------------------------------------------------------------
  // Column sorting
  // ---------------------------------------------------------------------------

  type SortField = "status" | "priority" | "created" | "due";
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "created" || field === "due" ? "desc" : "asc");
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
        case "created":
          cmp =
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
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
    <>
      {/* Page header */}
      <div className="mb-4 mt-2 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              My tickets
            </h1>
            <p className="mt-1 text-sm text-[#7a7a7a]">
              All design requests created for your company, with project,
              status, and creative information.
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
          <InlineAlert variant="error" title="Error" className="mb-4">
            {error}
          </InlineAlert>
        )}

        {/* Filters */}
        <section className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <label className="block text-xs font-medium text-[#424143]">
              Search
            </label>
            <FormInput
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ticket, project, creative..."
              size="sm"
              className="mt-1"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-[#424143]">
                Status
              </label>
              <FormSelect
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as "ALL" | TicketStatus)
                }
                size="sm"
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
              <label className="text-xs font-medium text-[#424143]">
                Project
              </label>
              <FormSelect
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                size="sm"
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
          </div>
        </section>

        {/* Tickets table */}
        {!loading && filteredTickets.length === 0 && !error && (
          <EmptyState title="No tickets found for this filter." />
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
                <TH>Assigned</TH>
                <TH>Job type</TH>
                <TH
                  sortable
                  sortDirection={sortField === "created" ? sortDir : null}
                  onSort={() => handleSort("created")}
                >
                  Created
                </TH>
                <TH
                  sortable
                  sortDirection={sortField === "due" ? sortDir : null}
                  onSort={() => handleSort("due")}
                >
                  Due
                </TH>
              </THead>
              <tbody>
                {sortedTickets.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-[#f0eeea] last:border-b-0 cursor-pointer transition-colors hover:bg-[var(--bb-bg-warm)]"
                    onClick={() =>
                      (window.location.href =
                        `/customer/tickets/${t.id}`)
                    }
                  >
                    <TD>
                      <div className="font-medium text-[#424143]">
                        {t.code}
                      </div>
                      <div className="text-[11px] text-[#7a7a7a]">
                        {t.title}
                      </div>
                    </TD>
                    <TD>
                      <div className="text-[11px] font-medium text-[#424143]">
                        {t.projectName ?? "-"}
                      </div>
                      {t.projectCode && (
                        <div className="text-[11px] text-[#9a9892]">
                          {t.projectCode}
                        </div>
                      )}
                    </TD>
                    <TD>
                      <Badge variant={statusBadgeVariant(t.status)}>
                        {formatStatusLabel(t.status)}
                      </Badge>
                    </TD>
                    <TD>
                      <Badge variant={priorityBadgeVariant(t.priority)}>
                        {formatPriorityLabel(t.priority)}
                      </Badge>
                    </TD>
                    <TD>
                      <div className="text-[11px] text-[#424143]">
                        {t.isAssigned ? "Yes" : "-"}
                      </div>
                    </TD>
                    <TD>
                      <div className="text-[11px] text-[#424143]">
                        {t.jobTypeName ?? "-"}
                      </div>
                    </TD>
                    <TD className="text-[#7a7a7a]">
                      {formatDate(t.createdAt)}
                    </TD>
                    <TD>
                      {t.dueDate ? (
                        <span
                          className={
                            isDueDateOverdue(t.dueDate)
                              ? "font-semibold text-[var(--bb-danger-text)]"
                              : isDueDateSoon(t.dueDate)
                                ? "font-semibold text-[var(--bb-warning-text)]"
                                : "text-[#7a7a7a]"
                          }
                        >
                          {formatDate(t.dueDate)}
                        </span>
                      ) : (
                        <span className="text-[#7a7a7a]">-</span>
                      )}
                    </TD>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </section>
        )}

        {loading && (
          <section className="rounded-2xl border border-[#e3e1dc] bg-white px-4 shadow-sm">
            <LoadingState message="Loading tickets…" />
          </section>
        )}
    </>
  );
}
