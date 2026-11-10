// -----------------------------------------------------------------------------
// @file: app/customer/tickets/page.tsx
// @purpose: Customer-facing tickets list with server-driven search, filtering,
//           sorting and pagination
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-02-21
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { DraftsLink } from "@/components/dashboard/tickets/drafts-link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  ButtonLink,
  Callout,
  Card,
  DASH,
  EmptyState,
  FilterChips,
  PageHeader,
  plural,
  SearchInput,
  Select,
  Skeleton,
  Table,
  TableFooter,
  Td,
  Th,
} from "@/components/admin/v2/ui";
import { IconChevronDown } from "@/components/admin/v2/icons";
import {
  DueDate,
  PriorityBadge,
  SortableTh,
  StatusBadge,
  TicketViewToggle,
} from "@/components/dashboard/tickets/shared";
import type { CompanyRole as CompanyRoleString } from "@/lib/permissions/companyRoles";
import { canCreateTickets } from "@/lib/permissions/companyRoles";
import { formatBoardDate } from "@/lib/board";
import { useLiveRefresh } from "@/lib/hooks/use-live-refresh";

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

const COMPANY_ROLE_LABEL: Record<CompanyRoleString, string> = {
  OWNER: "Owner",
  PM: "Project manager",
  BILLING: "Billing manager",
  MEMBER: "Member",
};

const PAGE_SIZE = 50;

export default function CustomerTicketsPage() {
  const router = useRouter();
  const [company, setCompany] = useState<CustomerTicketsResponse["company"]>();
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

  // Whole-company status counts for the filter chips
  const [statusCounts, setStatusCounts] = useState<{
    total: number;
    byStatus: Record<TicketStatus, number>;
  } | null>(null);

  // Company role
  const [companyRole, setCompanyRole] = useState<CompanyRoleString | null>(null);
  const [companyRoleLoading, setCompanyRoleLoading] = useState<boolean>(true);

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
  const fetchTickets = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      const id = ++fetchIdRef.current;
      if (!silent) {
        setLoading(true);
        setError(null);
      }

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

        const res = await fetch(`/api/customer/tickets?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);

        if (id !== fetchIdRef.current) return; // stale

        if (!res.ok) {
          throw new Error(json?.error || `Request failed with status ${res.status}`);
        }

        const data = json as CustomerTicketsResponse;
        setCompany(data.company);
        setTickets(data.tickets);
        setPagination(data.pagination);
      } catch (err: any) {
        if (id !== fetchIdRef.current) return;
        if (silent) return; // background refresh: keep what's on screen
        console.error("Customer tickets fetch error:", err);
        setError(err?.message || "Failed to load requests.");
      } finally {
        if (id === fetchIdRef.current) {
          setLoading(false);
        }
      }
    },
    [
      debouncedSearch,
      statusFilter,
      projectFilter,
      priorityFilter,
      tagFilter,
      sortField,
      sortDir,
      page,
    ],
  );

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Stay current without a reload: on return to the tab and every 30s while visible.
  useLiveRefresh(() => fetchTickets({ silent: true }));

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
    return () => {
      cancelled = true;
    };
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

    // Counts for the status chips. Optional: the chips work without them.
    fetch("/api/customer/board", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json?.stats?.byStatus) setStatusCounts(json.stats);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
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

  const canCreateNewTicket = companyRoleLoading ? false : canCreateTickets(companyRole);

  const sortDirection = (field: SortField) => (sortField === field ? sortDir : null);

  const totalShown = pagination
    ? Math.min(page * PAGE_SIZE + tickets.length, pagination.total)
    : tickets.length;

  // The chip counts are for the whole company, so they'd mislead next to a
  // narrower search or filter. Show them only on the unfiltered list.
  const otherFiltersActive =
    debouncedSearch !== "" ||
    projectFilter !== "ALL" ||
    priorityFilter !== "ALL" ||
    tagFilter !== "ALL";
  const anyFilterActive = otherFiltersActive || statusFilter !== "ALL";
  const countFor = (value: "ALL" | TicketStatus) =>
    !statusCounts || otherFiltersActive
      ? null
      : value === "ALL"
        ? statusCounts.total
        : statusCounts.byStatus[value];

  return (
    <>
      <PageHeader
        title="My requests"
        description="All creative requests created for your company, with project, status, and creative information."
        meta={
          company ? (
            <>
              Company <span className="font-medium text-[var(--av2-text)]">{company.name}</span>
              {companyRole ? (
                <>
                  {" · "}You are browsing as{" "}
                  <span className="font-medium text-[var(--av2-text)]">
                    {COMPANY_ROLE_LABEL[companyRole]}
                  </span>
                </>
              ) : null}
            </>
          ) : null
        }
        actions={
          canCreateNewTicket ? (
            <>
              <DraftsLink />
              <ButtonLink href="/customer/tickets/new" variant="primary">
                + New request
              </ButtonLink>
            </>
          ) : null
        }
      />

      <div className="space-y-4">
        <TicketViewToggle rolePath="/customer" />

        {!error && !companyRoleLoading && companyRole === "BILLING" ? (
          <Callout tone="warning" title="Limited access">
            Your billing role can review existing requests, but it can't create new ones for this
            workspace. Ask your company owner or a project manager to add one.
          </Callout>
        ) : null}

        {error ? (
          <Callout tone="error" title="We couldn't load your requests">
            {error}
          </Callout>
        ) : null}

        <FilterChips
          label="Filter by status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "ALL", label: "All", count: countFor("ALL") },
            { value: "TODO", label: "Backlog", count: countFor("TODO") },
            { value: "IN_PROGRESS", label: "In progress", count: countFor("IN_PROGRESS") },
            { value: "IN_REVIEW", label: "In review", count: countFor("IN_REVIEW") },
            { value: "DONE", label: "Done", count: countFor("DONE") },
          ]}
        />

        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            label="Search requests"
            placeholder="Search by request, project or service…"
            className="min-w-[240px] flex-1"
          />
          <div className="w-full sm:w-52">
            <Select
              aria-label="Filter by project"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
            >
              <option value="ALL">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-full sm:w-44">
            <Select
              aria-label="Filter by priority"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as "ALL" | TicketPriority)}
            >
              <option value="ALL">All priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </Select>
          </div>
          {availableTags.length > 0 ? (
            <div className="w-full sm:w-44">
              <Select
                aria-label="Filter by tag"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
              >
                <option value="ALL">All tags</option>
                {availableTags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
        </div>

        {loading ? (
          <div aria-busy="true" aria-label="Loading requests" className="space-y-3">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : tickets.length === 0 ? (
          error ? null : (
            <Card>
              {anyFilterActive ? (
                <EmptyState
                  title="No requests match these filters"
                  description="Try a different status, project or search."
                />
              ) : (
                <EmptyState
                  title="No requests yet"
                  description="Requests created for your company will appear here."
                  action={
                    canCreateNewTicket ? (
                      <ButtonLink href="/customer/tickets/new" variant="primary">
                        + New request
                      </ButtonLink>
                    ) : undefined
                  }
                />
              )}
            </Card>
          )
        ) : (
          <Card padding="none">
            <Table label="Requests">
              <thead className="max-lg:hidden">
                <tr>
                  <Th>Request</Th>
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
                  <Th className="max-xl:hidden">Service</Th>
                  <Th>Assigned</Th>
                  <SortableTh
                    label="Created"
                    className="max-xl:hidden"
                    direction={sortDirection("createdAt")}
                    onSort={() => handleSort("createdAt")}
                  />
                  <SortableTh
                    label="Due"
                    direction={sortDirection("dueDate")}
                    onSort={() => handleSort("dueDate")}
                  />
                  <Th>
                    <span className="sr-only">Open</span>
                  </Th>
                </tr>
              </thead>
              <tbody className="max-lg:block">
                {tickets.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => router.push(`/customer/tickets/${t.id}`)}
                    className="cursor-pointer border-b border-[var(--av2-border)] last:border-b-0 hover:bg-[var(--av2-bg)] max-lg:block max-lg:p-4"
                  >
                    <Td className="max-lg:block max-lg:!p-0">
                      <p className="text-[var(--av2-text-2)]">{t.code}</p>
                      <Link
                        href={`/customer/tickets/${t.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold hover:underline"
                      >
                        {t.title}
                      </Link>
                    </Td>
                    <Td className="max-lg:mt-1 max-lg:block max-lg:!p-0">
                      <p>{t.projectName ?? DASH}</p>
                      {t.projectCode ? (
                        <p className="text-xs text-[var(--av2-text-2)]">{t.projectCode}</p>
                      ) : null}
                    </Td>
                    <Td className="max-lg:mt-2 max-lg:inline-block max-lg:!p-0">
                      <StatusBadge status={t.status} />
                    </Td>
                    <Td className="max-lg:mt-2 max-lg:ml-2 max-lg:inline-block max-lg:!p-0">
                      <PriorityBadge priority={t.priority} />
                    </Td>
                    <Td className="max-xl:hidden">{t.jobTypeName ?? DASH}</Td>
                    <Td className="max-lg:mt-2 max-lg:block max-lg:!p-0">
                      <span className="text-[var(--av2-text-2)] lg:hidden">Assigned: </span>
                      {t.isAssigned ? "Yes" : DASH}
                    </Td>
                    <Td className="whitespace-nowrap text-[var(--av2-text-2)] max-xl:hidden">
                      {formatBoardDate(t.createdAt)}
                    </Td>
                    <Td className="whitespace-nowrap max-lg:mt-1 max-lg:block max-lg:!p-0">
                      <span className="text-[var(--av2-text-2)] lg:hidden">Due: </span>
                      <DueDate iso={t.dueDate} done={t.status === "DONE"} />
                    </Td>
                    <Td className="text-[var(--av2-text-2)] max-lg:hidden">
                      <IconChevronDown className="-rotate-90" />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {pagination ? (
              <TableFooter>
                <span>
                  Showing {page * PAGE_SIZE + 1}–{totalShown} of {pagination.total}{" "}
                  {plural(pagination.total, "request", "requests")}
                </span>
                {pagination.total > PAGE_SIZE ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      disabled={page === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      Previous
                    </Button>
                    <span className="tabular-nums">
                      Page {page + 1} of {Math.ceil(pagination.total / PAGE_SIZE)}
                    </span>
                    <Button disabled={!pagination.hasMore} onClick={() => setPage((p) => p + 1)}>
                      Next
                    </Button>
                  </div>
                ) : null}
              </TableFooter>
            ) : null}
          </Card>
        )}
      </div>
    </>
  );
}
