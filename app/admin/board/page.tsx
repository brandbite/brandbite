// -----------------------------------------------------------------------------
// @file: app/admin/board/page.tsx
// @purpose: Admin-facing kanban board over all tickets (read-only). Restyled
//           on the admin design language v1 (`.bb-admin-v2` tokens + shared
//           primitives in components/admin/v2/ui.tsx).
// @version: v3.0.0
// @status: active
// @lastUpdate: 2026-11-01
// -----------------------------------------------------------------------------

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { fetchAllTickets } from "@/lib/fetch-all-tickets";
import Link from "next/link";
import { useToast } from "@/components/ui/toast-provider";
import { STATUS_ORDER, isDueDateOverdue } from "@/lib/board";
import type { TicketStatus } from "@/lib/board";
import { stripHtml } from "@/components/ui/safe-html";
import { buildTicketCode } from "@/lib/ticket-code";
import {
  Avatar,
  Badge,
  Button,
  Callout,
  DASH,
  PRIORITY,
  PageHeader,
  SearchInput,
  SegmentedControl,
  Select,
  Skeleton,
  TICKET_STATUS,
  TextLink,
  fmt,
  plural,
  type Tone,
} from "@/components/admin/v2/ui";
import { IconAlertCircle, IconArrowUpRight, IconClock } from "@/components/admin/v2/icons";

type AdminTicket = {
  id: string;
  title: string;
  /// Sanitized rich-text description. Stripped + truncated client-side
  /// for the card preview; the full body lives at /admin/tickets/[id].
  description: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate: string | null;
  /// Per-company ticket number — used together with project code +
  /// fallback id to build the human-readable ticket code in the card
  /// footer.
  companyTicketNumber: number | null;
  status: TicketStatus;
  createdAt: string;
  company: { id: string; name: string } | null;
  project: { id: string; name: string; code: string | null } | null;
  creative: { id: string; name: string | null; email: string } | null;
  jobType: { id: string; name: string } | null;
  tags: { id: string; name: string; color: string }[];
};

type AdminTicketsResponse = {
  tickets: AdminTicket[];
};

type AdminBoardStats = {
  byStatus: Record<TicketStatus, number>;
  total: number;
  openTotal: number;
  overdue: number;
};

const VIEW_OPTIONS = [
  { value: "board", label: "Kanban", href: "/admin/board" },
  { value: "table", label: "Table", href: "/admin/tickets" },
] as const;

// Column tint: a whisper of the status fill over the surface, so the four
// lanes read as distinct without new colour tokens (works in dark too).
const COLUMN_FILL: Record<string, string> = {
  TODO: "var(--av2-fill-neutral)",
  IN_PROGRESS: "var(--av2-fill-lavender)",
  IN_REVIEW: "var(--av2-fill-orange)",
  DONE: "var(--av2-fill-green)",
};

const AVATAR_TONES: Tone[] = ["blue", "lavender", "peach", "green", "amber"];
function avatarTone(key: string): Tone {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

function formatDue(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Page-local lock glyph (same 24px / 1.75 stroke family as the v2 icons). */
function IconLock(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...p}
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export default function AdminBoardPage() {
  const { showToast } = useToast();

  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState<string>("");
  const [companyFilter, setCompanyFilter] = useState<string>("ALL");
  const [creativeFilter, setCreativeFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [overdueOnly, setOverdueOnly] = useState<boolean>(false);

  // ---------------------------------------------------------------------------
  // Data load
  // ---------------------------------------------------------------------------

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      // All pages — the API returns the 50 newest by default, which capped
      // the board (and its counts and filters) at 50 tickets.
      const json = await fetchAllTickets<AdminTicketsResponse>("/api/admin/tickets");
      setTickets(json.tickets);
    } catch (err) {
      console.error("[AdminBoardPage] load error", err);
      const message =
        err instanceof Error ? err.message : "Failed to load tickets. Please try again.";

      setError(message);

      showToast({
        type: "error",
        title: "Could not load admin board",
        description: message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-run auto-assign across currently-unassigned TODO tickets. Useful for
  // tickets created before a company turned auto-assign on. Safe to re-run.
  const [backfilling, setBackfilling] = useState<boolean>(false);
  const runAutoAssignBackfill = async () => {
    setBackfilling(true);
    try {
      const res = await fetch("/api/admin/tickets/auto-assign-backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json().catch(() => null)) as
        | { assigned: number; scanned: number; skipped: number; hasMore: boolean }
        | { error?: string }
        | null;
      if (!res.ok || !json || !("assigned" in json)) {
        const message =
          json && "error" in json && json.error ? json.error : `Failed (${res.status})`;
        throw new Error(message);
      }
      showToast({
        type: "success",
        title: `Assigned ${json.assigned} of ${json.scanned} ticket(s)`,
        description:
          json.skipped > 0
            ? `${json.skipped} skipped (auto-assign off, no eligible creative, or already claimed).${
                json.hasMore ? " More remain — run again." : ""
              }`
            : json.hasMore
              ? "More tickets remain — run again."
              : "All eligible unassigned tickets processed.",
      });
      await load();
    } catch (err) {
      showToast({
        type: "error",
        title: "Auto-assign backfill failed",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setBackfilling(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const isOverdue = (t: AdminTicket) => t.status !== "DONE" && isDueDateOverdue(t.dueDate);

  const stats: AdminBoardStats = useMemo(() => {
    const byStatus: Record<TicketStatus, number> = {
      TODO: 0,
      IN_PROGRESS: 0,
      IN_REVIEW: 0,
      DONE: 0,
      // Cancelled rows are filtered out at the API; only here to
      // satisfy Record<TicketStatus, …>.
      CANCELED: 0,
    };

    let overdue = 0;
    for (const t of tickets) {
      byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
      if (t.status !== "DONE" && isDueDateOverdue(t.dueDate)) overdue++;
    }

    const total = tickets.length;
    const openTotal = total - (byStatus.DONE ?? 0);

    return {
      byStatus,
      total,
      openTotal,
      overdue,
    };
  }, [tickets]);

  const companies = useMemo(() => {
    const set = new Set<string>();
    tickets.forEach((t) => {
      if (t.company?.name) set.add(t.company.name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [tickets]);

  /** Deduped creative list (filter options + legend) */
  const uniqueCreatives = useMemo(() => {
    const seen = new Map<string, { id: string; name: string | null; email: string }>();
    tickets.forEach((t) => {
      if (t.creative && !seen.has(t.creative.id)) {
        seen.set(t.creative.id, {
          id: t.creative.id,
          name: t.creative.name,
          email: t.creative.email,
        });
      }
    });
    return Array.from(seen.values()).sort((a, b) =>
      (a.name || a.email).localeCompare(b.name || b.email),
    );
  }, [tickets]);

  const hasUnassigned = useMemo(() => tickets.some((t) => !t.creative), [tickets]);

  const filtersActive =
    search.trim() !== "" ||
    companyFilter !== "ALL" ||
    creativeFilter !== "ALL" ||
    priorityFilter !== "ALL" ||
    overdueOnly;

  const clearFilters = () => {
    setSearch("");
    setCompanyFilter("ALL");
    setCreativeFilter("ALL");
    setPriorityFilter("ALL");
    setOverdueOnly(false);
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (companyFilter !== "ALL" && t.company?.name !== companyFilter) {
        return false;
      }
      if (creativeFilter === "__none__" && t.creative) return false;
      if (
        creativeFilter !== "ALL" &&
        creativeFilter !== "__none__" &&
        t.creative?.id !== creativeFilter
      ) {
        return false;
      }
      if (priorityFilter !== "ALL" && t.priority !== priorityFilter) return false;
      if (overdueOnly && !(t.status !== "DONE" && isDueDateOverdue(t.dueDate))) return false;

      const q = search.trim().toLowerCase();
      if (q) {
        const haystack = [
          t.title,
          t.company?.name ?? "",
          t.project?.name ?? "",
          t.project?.code ?? "",
          t.creative?.name ?? "",
          t.creative?.email ?? "",
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [tickets, companyFilter, creativeFilter, priorityFilter, overdueOnly, search]);

  const ticketsByStatus = useMemo(() => {
    const map: Record<TicketStatus, AdminTicket[]> = {
      TODO: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      DONE: [],
      // Cancelled rows are filtered out at the API; bucket exists only
      // to satisfy Record<TicketStatus, …>.
      CANCELED: [],
    };

    for (const t of filteredTickets) {
      map[t.status].push(t);
    }

    return map;
  }, [filteredTickets]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const ready = !loading || tickets.length > 0;

  return (
    <div>
      <PageHeader
        title="Board"
        description="Every request, one clear view."
        meta={
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base">
            <span>
              <span className="font-semibold text-[var(--av2-text)] tabular-nums">
                {ready ? fmt(stats.total) : DASH}
              </span>{" "}
              total {plural(stats.total, "ticket", "tickets")}
            </span>
            <span aria-hidden>·</span>
            <span>
              <span className="tabular-nums">{ready ? fmt(stats.openTotal) : DASH}</span> open
            </span>
            {ready && stats.overdue > 0 && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-2 font-semibold text-[var(--av2-text)]">
                  <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[var(--av2-fill-red)]" />
                  <span>
                    <span className="tabular-nums">{fmt(stats.overdue)}</span> overdue
                  </span>
                </span>
              </>
            )}
          </p>
        }
        actions={
          <>
            <span
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--av2-border)] px-4 text-sm text-[var(--av2-text-2)]"
              title="Cards open the ticket detail page; status changes happen there."
            >
              <IconLock />
              Read-only board
            </span>
            <Button
              onClick={runAutoAssignBackfill}
              disabled={backfilling}
              title="Re-run auto-assign for unassigned tickets (e.g. created before auto-assign was enabled)"
            >
              {backfilling ? "Assigning…" : "Re-run auto-assign"}
            </Button>
          </>
        }
      />

      {error && (
        <div className="mb-6">
          <Callout
            tone="error"
            title="Something went wrong"
            action={
              <Button size="sm" onClick={load}>
                Retry
              </Button>
            }
          >
            {error}
          </Callout>
        </div>
      )}

      {/* Filters + view toggle */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search tickets"
          label="Search tickets"
          className="w-full sm:w-64"
        />
        <div className="w-full sm:w-44">
          <Select
            aria-label="Filter by company"
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
          >
            <option value="ALL">All companies</option>
            {companies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-full sm:w-44">
          <Select
            aria-label="Filter by creative"
            value={creativeFilter}
            onChange={(e) => setCreativeFilter(e.target.value)}
          >
            <option value="ALL">All creatives</option>
            {hasUnassigned && <option value="__none__">Unassigned</option>}
            {uniqueCreatives.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || c.email}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-full sm:w-40">
          <Select
            aria-label="Filter by priority"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="ALL">All priorities</option>
            {(["URGENT", "HIGH", "MEDIUM", "LOW"] as const).map((p) => (
              <option key={p} value={p}>
                {PRIORITY[p].label}
              </option>
            ))}
          </Select>
        </div>
        <button
          type="button"
          aria-pressed={overdueOnly}
          onClick={() => setOverdueOnly((v) => !v)}
          className={`inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:ring-offset-1 focus-visible:outline-none ${
            overdueOnly
              ? "border-[var(--av2-error)] bg-[var(--av2-selected)] text-[var(--av2-error-text)]"
              : "border-[var(--av2-error)]/40 bg-[var(--av2-surface)] text-[var(--av2-error-text)] hover:bg-[var(--av2-selected)]"
          }`}
        >
          Overdue
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--av2-selected)] px-1.5 text-xs font-semibold tabular-nums">
            {ready ? stats.overdue : DASH}
          </span>
        </button>
        {filtersActive && (
          <Button variant="ghost" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
        <div className="ml-auto">
          <SegmentedControl label="Board view" value="board" options={[...VIEW_OPTIONS]} />
        </div>
      </div>

      {/* Columns. min-w-0 on the wrapper lets the strip scroll internally
          instead of pushing the page wider than the viewport. */}
      <div className="min-w-0 overflow-x-auto pb-2" aria-busy={loading}>
        {loading && (
          <p className="sr-only" role="status">
            Loading board…
          </p>
        )}
        <div className="grid min-w-[1040px] grid-cols-4 gap-4">
          {STATUS_ORDER.map((status) => {
            const columnTickets = ticketsByStatus[status] || [];
            const meta = TICKET_STATUS[status];
            const fill = COLUMN_FILL[status];
            const headingId = `board-col-${status}`;

            return (
              <section
                key={status}
                aria-labelledby={headingId}
                className="flex min-h-[480px] flex-col rounded-2xl border border-[var(--av2-border)] p-3"
                style={{
                  background: `color-mix(in srgb, ${fill} 7%, var(--av2-surface))`,
                }}
              >
                {/* Column header */}
                <div className="flex items-center gap-3 px-2 pt-1 pb-3">
                  <span
                    aria-hidden
                    className="h-3.5 w-3.5 rounded-full"
                    style={{ background: fill }}
                  />
                  <h2 id={headingId} className="text-lg leading-6 font-semibold">
                    {meta.label}
                  </h2>
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--av2-track)] px-2 text-xs font-semibold tabular-nums">
                    {loading && tickets.length === 0 ? DASH : columnTickets.length}
                  </span>
                </div>

                {/* Cards */}
                <ul className="flex flex-col gap-3">
                  {loading && tickets.length === 0 ? (
                    [0, 1].map((i) => (
                      <li key={i}>
                        <Skeleton className="h-40 rounded-xl" />
                      </li>
                    ))
                  ) : columnTickets.length === 0 ? (
                    <li className="rounded-xl border border-dashed border-[var(--av2-border)] px-4 py-6 text-center text-sm text-[var(--av2-text-2)]">
                      {filtersActive ? "No tickets match these filters." : "No tickets here yet."}
                    </li>
                  ) : (
                    columnTickets.map((t) => <BoardCard key={t.id} t={t} overdue={isOverdue(t)} />)
                  )}
                </ul>

                {status === "DONE" && columnTickets.length > 0 && (
                  <div className="mt-auto px-2 pt-4">
                    <TextLink href="/admin/completed-jobs">View completed jobs</TextLink>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      {uniqueCreatives.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-[var(--av2-text-2)]">
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="Creatives">
            {uniqueCreatives.map((c) => {
              const label = c.name || c.email;
              return (
                <li key={c.id} className="flex items-center gap-2">
                  <Avatar name={label} size={28} tone={avatarTone(c.id)} />
                  {label}
                </li>
              );
            })}
          </ul>
          <span aria-hidden className="hidden h-5 w-px bg-[var(--av2-border)] sm:block" />
          <p className="flex items-center gap-2">
            <IconAlertCircle width={18} height={18} />
            Open a ticket to view its brief and history.
          </p>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Card
// -----------------------------------------------------------------------------

function BoardCard({ t, overdue }: { t: AdminTicket; overdue: boolean }) {
  const companyName = t.company?.name ?? DASH;
  const projectCode = t.project?.code ?? null;
  const creativeLabel = t.creative?.name || t.creative?.email || null;
  const dueLabel = formatDue(t.dueDate);
  const ticketCode = buildTicketCode({
    projectCode: t.project?.code,
    companyTicketNumber: t.companyTicketNumber,
    ticketId: t.id,
  });
  const brief = t.description ? stripHtml(t.description).trim() : "";
  const priority = PRIORITY[t.priority];

  return (
    <li>
      <Link
        href={`/admin/tickets/${t.id}`}
        title="Open ticket detail"
        className="group block rounded-xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-4 transition-colors hover:border-[var(--av2-accent)]/50 focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:ring-offset-1 focus-visible:outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          {/* Company name — admin-only context the customer / creative
              boards don't need */}
          <p className="min-w-0 truncate text-xs font-medium tracking-[0.12em] text-[var(--av2-text-2)] uppercase">
            {companyName}
          </p>
          <IconArrowUpRight
            width={16}
            height={16}
            className="shrink-0 text-[var(--av2-text-2)] group-hover:text-[var(--av2-link)]"
          />
        </div>

        <p className="mt-1.5 line-clamp-2 text-base leading-6 font-semibold">{t.title}</p>

        {/* Brief preview, stripped so admins don't see raw markup */}
        {brief ? (
          <p className="mt-1 line-clamp-2 text-sm text-[var(--av2-text-2)]">{brief}</p>
        ) : (
          <p className="mt-1 text-sm text-[var(--av2-text-2)] italic">No brief provided.</p>
        )}

        {(dueLabel || t.tags.length > 0) && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {dueLabel && (
              <Badge tone={overdue ? "red" : "neutral"} icon={<IconClock width={14} height={14} />}>
                {overdue ? `${dueLabel} · Overdue` : `Due ${dueLabel}`}
              </Badge>
            )}
            {t.tags.slice(0, 3).map((tag) => (
              <Badge key={tag.id}>{tag.name}</Badge>
            ))}
            {t.tags.length > 3 && (
              <span className="text-xs text-[var(--av2-text-2)]">+{t.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Footer: ticket code · job type, priority, creative */}
        <div className="mt-3 flex items-center gap-2 border-t border-[var(--av2-border)] pt-3 text-xs text-[var(--av2-text-2)]">
          <span
            className="min-w-0 flex-1 truncate"
            title={`${projectCode ?? ticketCode} · ${t.jobType?.name ?? "Unspecified"}`}
          >
            <span className="font-medium">{projectCode ?? ticketCode}</span>
            {" · "}
            {t.jobType?.name ?? "Unspecified"}
          </span>
          {priority && (t.priority === "HIGH" || t.priority === "URGENT") && (
            <Badge tone={priority.tone}>{priority.label}</Badge>
          )}
          {creativeLabel ? (
            <span title={creativeLabel} className="inline-flex">
              <Avatar name={creativeLabel} size={28} tone={avatarTone(t.creative!.id)} />
              <span className="sr-only">Assigned to {creativeLabel}</span>
            </span>
          ) : (
            <span
              title="Unassigned"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--av2-border)] text-xs"
            >
              <span aria-hidden>?</span>
              <span className="sr-only">Unassigned</span>
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}
