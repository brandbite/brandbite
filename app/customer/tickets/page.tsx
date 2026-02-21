// -----------------------------------------------------------------------------
// @file: app/customer/tickets/page.tsx
// @purpose: Customer-facing tickets list with server-driven search, filtering,
//           sorting and pagination
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-02-21
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
} from "@/lib/board";

type TicketStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type CustomerTicket = {
  id: string;
  code: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  projectId: string | null;
  projectName: string | null;
  projectCode: string | null;
  isAssigned: boolean;
  jobTypeName: string | null;
  createdAt: string;
  dueDate: string | null;
  tags: { id: string; name: string; color: string }[];
};

type PaginationMeta = {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

type CustomerTicketsResponse = {
  company: {
    id: string;
    name: string;
    slug: string;
  };
  tickets: CustomerTicket[];
  pagination: PaginationMeta;
};

type TagOption = { id: string; name: string; color: string };

const STATUS_LABELS: Record<TicketStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  DONE: "Done",
};

const PAGE_SIZE = 50;

export default function CustomerTicketsPage() {
  const [company, setCompany] =
    useState<CustomerTicketsResponse["company"]>();
  const [tickets, setTickets] = useState<CustomerTicket[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | TicketStatus>("ALL");
  const [projectFilter, setProjectFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | TicketPriority>("ALL");
  const [tagFilter, setTagFilter] = useState<string>("ALL");

  // Sorting
  type SortField = "status" | "priority" | "createdAt" | "dueDate" | "title";
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Pagination
  const [page, setPage] = useState(0);

  // Tags for filter dropdown
  const [availableTags, setAvailableTags] = useState<TagOption[]>([]);

  // Projects derived from first load
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  // Company role
  const [companyRole, setCompanyRole] =
    useState<CompanyRoleString | null>(null);
  const [companyRoleLoading, setCompanyRoleLoading] =
    useState<boolean>(true);

  // Ref for cancellation
  const fetchIdRef = useRef(0);

  // ---- Debounce search ----
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0); // reset to first page on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [statusFilter, projectFilter, priorityFilter, tagFilter]);

  // ---- Fetch tickets ----
  const fetchTickets = useCallback(async () => {
    const id = ++fetchIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (projectFilter !== "ALL") params.set("project", projectFilter);
      if (priorityFilter !== "ALL") params.set("priority", priorityFilter);
      if (tagFilter !== "ALL") params.set("tag", tagFilter);
      params.set("sortBy", sortField);
      params.set("sortDir", sortDir);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(page * PAGE_SIZE));

      const res = await fetch(
        `/api/customer/tickets?${params.toString()}`,
        { cache: "no-store" },
      );
      const json = await res.json().catch(() => null);

      if (id !== fetchIdRef.current) return; // stale

      if (!res.ok) {
        throw new Error(
          json?.error || `Request failed with status ${res.status}`,
        );
      }

      const data = json as CustomerTicketsResponse;
      setCompany(data.company);
      setTickets(data.tickets);
      setPagination(data.pagination);
    } catch (err: any) {
      if (id !== fetchIdRef.current) return;
      console.error("Customer tickets fetch error:", err);
      setError(err?.message || "Failed to load tickets.");
    } finally {
      if (id === fetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [debouncedSearch, statusFilter, projectFilter, priorityFilter, tagFilter, sortField, sortDir, page]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // ---- Load company role ----
  useEffect(() => {
    let cancelled = false;
    const loadRole = async () => {
      try {
        const res = await fetch("/api/customer/settings", {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) return;
        if (!cancelled) {
          const role = json?.user?.companyRole ?? null;
          if (["OWNER", "PM", "BILLING", "MEMBER"].includes(role)) {
            setCompanyRole(role);
          } else {
            setCompanyRole(null);
          }
        }
      } catch (err) {
        console.error("[CustomerTicketsPage] Failed to load company role", err);
      } finally {
        if (!cancelled) setCompanyRoleLoading(false);
      }
    };
    loadRole();
    return () => { cancelled = true; };
  }, []);

  // ---- Load tags + projects (once) ----
  useEffect(() => {
    let cancelled = false;

    // Load tags
    fetch("/api/customer/tags", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json?.tags) {
          setAvailableTags(json.tags);
        }
      })
      .catch(() => {});

    // Load all projects from initial unfiltered ticket set for the dropdown
    fetch("/api/customer/tickets?limit=200", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json?.tickets) {
          const projectMap = new Map<string, string>();
          for (const t of json.tickets) {
            if (t.projectId && t.projectName) {
              projectMap.set(t.projectId, t.projectName);
            }
          }
          const sorted = Array.from(projectMap.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
          setProjects(sorted);
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, []);

  // ---- Sorting handler ----
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "createdAt" || field === "dueDate" ? "desc" : "asc");
    }
    setPage(0);
  };

  const canCreateNewTicket = companyRoleLoading
    ? false
    : canCreateTickets(companyRole);

  const formatDate = (iso: string | null) => {
    if (!iso) return "-";
    return new Date(iso).toLocaleDateString();
  };

  const formatStatusLabel = (status: TicketStatus) => STATUS_LABELS[status];

  const formatPriorityLabel = (priority: TicketPriority) => {
    switch (priority) {
      case "LOW": return "Low";
      case "MEDIUM": return "Medium";
      case "HIGH": return "High";
      case "URGENT": return "Urgent";
    }
  };

  const totalShown = pagination
    ? Math.min(page * PAGE_SIZE + tickets.length, pagination.total)
    : tickets.length;

  return (
    <>
      {/* Page header */}
      <div className="mb-4 mt-2 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              My tickets
            </h1>
            <p className="mt-1 text-sm text-[#7a7a7a]">
              All creative requests created for your company, with project,
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

            {!loading && pagination && (
              <div className="rounded-full bg-[#f5f3f0] px-3 py-1 text-xs text-[#7a7a7a]">
                {pagination.total} ticket
                {pagination.total === 1 ? "" : "s"} total
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
        <section className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex-1">
            <label className="block text-xs font-medium text-[#424143]">
              Search
            </label>
            <FormInput
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ticket, project, job type..."
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
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </FormSelect>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-[#424143]">
                Priority
              </label>
              <FormSelect
                value={priorityFilter}
                onChange={(e) =>
                  setPriorityFilter(e.target.value as "ALL" | TicketPriority)
                }
                size="sm"
                className="w-auto"
              >
                <option value="ALL">All</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </FormSelect>
            </div>

            {availableTags.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-[#424143]">
                  Tag
                </label>
                <FormSelect
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  size="sm"
                  className="w-auto"
                >
                  <option value="ALL">All tags</option>
                  {availableTags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </FormSelect>
              </div>
            )}
          </div>
        </section>

        {/* Tickets table */}
        {!loading && tickets.length === 0 && !error && (
          <EmptyState title="No tickets found for this filter." />
        )}

        {!loading && tickets.length > 0 && (
          <section className="rounded-2xl border border-[#e3e1dc] bg-white px-4 py-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight">
                Tickets
              </h2>
              {pagination && (
                <p className="text-xs text-[#9a9892]">
                  Showing {page * PAGE_SIZE + 1}–{totalShown} of{" "}
                  {pagination.total} tickets
                </p>
              )}
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
                <TH className="hidden md:table-cell">Assigned</TH>
                <TH className="hidden md:table-cell">Job type</TH>
                <TH
                  className="hidden md:table-cell"
                  sortable
                  sortDirection={sortField === "createdAt" ? sortDir : null}
                  onSort={() => handleSort("createdAt")}
                >
                  Created
                </TH>
                <TH
                  sortable
                  sortDirection={sortField === "dueDate" ? sortDir : null}
                  onSort={() => handleSort("dueDate")}
                >
                  Due
                </TH>
              </THead>
              <tbody>
                {tickets.map((t) => (
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
                    <TD className="hidden md:table-cell">
                      <div className="text-[11px] text-[#424143]">
                        {t.isAssigned ? "Yes" : "-"}
                      </div>
                    </TD>
                    <TD className="hidden md:table-cell">
                      <div className="text-[11px] text-[#424143]">
                        {t.jobTypeName ?? "-"}
                      </div>
                    </TD>
                    <TD className="hidden md:table-cell text-[#7a7a7a]">
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

            {/* Pagination controls */}
            {pagination && pagination.total > PAGE_SIZE && (
              <div className="mt-4 flex items-center justify-between border-t border-[#f0eeea] pt-3">
                <p className="text-xs text-[#9a9892]">
                  Page {page + 1} of {Math.ceil(pagination.total / PAGE_SIZE)}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    className="rounded-full border border-[#e3e1dc] px-3 py-1 text-[11px] font-medium text-[#424143] transition-colors hover:bg-[#f5f3f0] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ← Previous
                  </button>
                  <button
                    type="button"
                    disabled={!pagination.hasMore}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded-full border border-[#e3e1dc] px-3 py-1 text-[11px] font-medium text-[#424143] transition-colors hover:bg-[#f5f3f0] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {loading && (
          <section className="rounded-2xl border border-[#e3e1dc] bg-white px-4 shadow-sm">
            <LoadingState message="Loading tickets..." />
          </section>
        )}
    </>
  );
}
