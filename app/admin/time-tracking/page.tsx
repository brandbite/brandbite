// -----------------------------------------------------------------------------
// @file: app/admin/time-tracking/page.tsx
// @purpose: Admin time-tracking analytics (admin design language v1) —
//           logged hours per ticket joined with the job type's estimated
//           hours so ops can see overruns and tune token pricing. The empty
//           state explains why there is nothing to compare and links to the
//           tickets and job-type estimates.
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-11-01
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  ButtonLink,
  Callout,
  Card,
  CardTitle,
  DASH,
  EmptyState,
  FilterBar,
  IconTile,
  KpiCard,
  PageHeader,
  SearchInput,
  SegmentedControl,
  Skeleton,
  TICKET_STATUS,
  Table,
  TableFooter,
  Td,
  Th,
  Tr,
  fmt,
  plural,
  type Tone,
} from "@/components/admin/v2/ui";
import {
  IconAlertCircle,
  IconArrowUpRight,
  IconClock,
  IconDocument,
  IconTicket,
} from "@/components/admin/v2/icons";

type Row = {
  ticketId: string;
  code: string;
  title: string;
  status: string;
  creative: { id: string; name: string | null; email: string } | null;
  company: { id: string; name: string } | null;
  jobType: {
    id: string;
    name: string;
    estimatedHours: number | null;
    tokenCost: number;
  } | null;
  loggedSeconds: number;
  loggedHours: number;
  estimatedHours: number | null;
  estimateRatio: number | null;
  entryCount: number;
  hasRunningEntry: boolean;
  completedAt: string | null;
};

type Response = {
  rows: Row[];
  stats: {
    ticketCount: number;
    totalLoggedHours: number;
    totalEstimatedHours: number;
    overrunCount: number;
  };
  migrationPending?: boolean;
};

type SortKey = "logged" | "variance" | "recent";

function formatHours(hours: number): string {
  if (hours <= 0) return "0h";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * Logged minus estimated, as signed text ("+1h 30m over", "−45m under").
 * Returns null when there is no estimate — never compare against a missing
 * estimate.
 */
function variance(row: Row): { text: string; pct: string; tone: Tone } | null {
  if (row.estimatedHours == null || row.estimateRatio == null) return null;
  const diff = row.loggedHours - row.estimatedHours;
  const pct = `${Math.round(row.estimateRatio * 100)}% of estimate`;
  // Under a minute either way reads as "on estimate".
  if (Math.abs(diff) < 1 / 60) return { text: "On estimate", pct, tone: "neutral" };
  if (diff > 0) {
    return {
      text: `+${formatHours(diff)} over`,
      pct,
      tone: row.estimateRatio > 1.5 ? "red" : "amber",
    };
  }
  return { text: `−${formatHours(-diff)} under`, pct, tone: "green" };
}

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const IconBars = () => (
  <Glyph>
    <path d="M6 20v-6M12 20V8M18 20V4" />
  </Glyph>
);

const STEPS: { n: number; tone: Tone; title: string; body: string }[] = [
  {
    n: 1,
    tone: "lavender",
    title: "Logged hours",
    body: "Time creatives record on each request with the request timer.",
  },
  {
    n: 2,
    tone: "peach",
    title: "Estimated hours",
    body: "The service's estimate per unit, multiplied by the request quantity.",
  },
  {
    n: 3,
    tone: "green",
    title: "Variance",
    body: "Logged minus estimated. A request is overrunning when logged time exceeds the estimate.",
  },
];

function HowItWorks() {
  return (
    <Card>
      <CardTitle>How comparisons work</CardTitle>
      <ol className="mt-4">
        {STEPS.map((s) => (
          <li
            key={s.n}
            className="flex gap-4 border-b border-[var(--av2-border)] py-4 first:pt-0 last:border-b-0"
          >
            <IconTile tone={s.tone} size={36} round>
              <span className="text-sm font-semibold">{s.n}</span>
            </IconTile>
            <div className="min-w-0">
              <p className="text-base font-semibold">{s.title}</p>
              <p className="mt-0.5 text-sm text-[var(--av2-text-2)]">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-2 flex items-start gap-2 border-t border-[var(--av2-border)] pt-4 text-sm text-[var(--av2-text-2)]">
        <IconAlertCircle width={18} height={18} className="mt-px shrink-0" />
        Requests whose service has no estimate show “—” and are left out of the variance and the
        overrun count.
      </p>
    </Card>
  );
}

export default function AdminTimeTrackingPage() {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("logged");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/time-tracking", { cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error || "Failed to load time-tracking analytics");
          return;
        }
        setData(json as Response);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load time-tracking analytics");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = search.trim().toLowerCase();
    let rows = data.rows;
    if (needle) {
      rows = rows.filter((r) => {
        const hay = [
          r.title,
          r.code,
          r.creative?.name ?? "",
          r.creative?.email ?? "",
          r.company?.name ?? "",
          r.jobType?.name ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(needle);
      });
    }
    const copy = [...rows];
    switch (sort) {
      case "variance":
        // Show overruns first — items with no estimate sink to the bottom
        copy.sort((a, b) => {
          const av = a.estimateRatio ?? -1;
          const bv = b.estimateRatio ?? -1;
          return bv - av;
        });
        break;
      case "recent":
        copy.sort((a, b) => {
          const ad = a.completedAt ? Date.parse(a.completedAt) : 0;
          const bd = b.completedAt ? Date.parse(b.completedAt) : 0;
          return bd - ad;
        });
        break;
      case "logged":
      default:
        copy.sort((a, b) => b.loggedSeconds - a.loggedSeconds);
        break;
    }
    return copy;
  }, [data, search, sort]);

  const stats = data?.stats;
  const rows = data?.rows ?? [];
  const hasRows = rows.length > 0;
  const estimatedCount = rows.filter((r) => r.estimatedHours != null).length;
  const pending = loading && !data;

  return (
    <>
      <PageHeader
        title="Time tracking"
        description="Compare logged hours with service estimates to spot overruns and retune token pricing."
        meta="Only requests with recorded time are listed."
      />

      {error && (
        <div className="mb-6">
          <Callout tone="error" title="Something went wrong">
            {error}
          </Callout>
        </div>
      )}

      {data?.migrationPending && (
        <div className="mb-6">
          <Callout tone="warning" title="Time-tracking migration is pending on this environment">
            The <code className="font-mono">TicketTimeEntry</code> table doesn&apos;t exist in the
            current database yet. Run <code className="font-mono">npx prisma migrate deploy</code>{" "}
            against this environment, then reload. Until then creatives can&apos;t log time and this
            page will stay empty.
          </Callout>
        </div>
      )}

      {!error && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={<IconTicket />}
            tone="lavender"
            label="Requests with logged time"
            value={pending ? DASH : fmt(stats?.ticketCount)}
            hint={stats && stats.ticketCount >= 200 ? "Capped at the top 200 by hours" : undefined}
          />
          <KpiCard
            icon={<IconClock />}
            tone="peach"
            label="Hours logged"
            value={pending || !stats ? DASH : formatHours(stats.totalLoggedHours)}
          />
          <KpiCard
            icon={<IconDocument />}
            tone="green"
            label="Estimated hours"
            value={pending || estimatedCount === 0 ? DASH : formatHours(stats!.totalEstimatedHours)}
            hint={
              !hasRows
                ? "Available after time is logged"
                : estimatedCount === rows.length
                  ? "For the logged requests"
                  : `${fmt(estimatedCount)} of ${fmt(rows.length)} logged requests have an estimate`
            }
          />
          <KpiCard
            icon={<IconBars />}
            tone="neutral"
            label="Overrunning"
            value={pending || estimatedCount === 0 ? DASH : fmt(stats?.overrunCount)}
            hint={
              !hasRows
                ? "Available after time is logged"
                : estimatedCount === 0
                  ? "No logged request has an estimate"
                  : "Logged time above the estimate"
            }
          />
        </div>
      )}

      {pending ? (
        <Card padding="none">
          <div className="space-y-3 px-6 py-5" role="status">
            <span className="sr-only">Loading time tracking…</span>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </Card>
      ) : !data ? null : !hasRows ? (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
          <Card>
            <EmptyState
              icon={<IconClock width={28} height={28} />}
              title="No time has been logged yet"
              description={
                data.migrationPending
                  ? "Time logging is unavailable until the migration above has run."
                  : "Creatives log time from the timer on a request. Once they do, this view compares their hours with the service estimates."
              }
              action={
                <div className="flex flex-wrap justify-center gap-3">
                  <ButtonLink href="/admin/tickets" variant="primary">
                    View requests
                    <IconArrowUpRight />
                  </ButtonLink>
                  <ButtonLink href="/admin/job-types">
                    Review service estimates
                    <IconArrowUpRight />
                  </ButtonLink>
                </div>
              }
            />
          </Card>
          <HowItWorks />
        </div>
      ) : (
        <>
          <Card padding="none">
            <div className="px-6 pt-5">
              <div className="mb-4">
                <CardTitle description="Estimated hours scale with request quantity.">
                  Hours vs estimate
                </CardTitle>
              </div>
              <FilterBar>
                <SearchInput
                  className="min-w-[220px] flex-1"
                  value={search}
                  onChange={setSearch}
                  placeholder="Search title, creative, company…"
                  label="Search requests by title, code, creative, company or service"
                />
                <SegmentedControl
                  label="Sort requests"
                  value={sort}
                  onChange={setSort}
                  options={[
                    { value: "logged", label: "Most logged" },
                    { value: "variance", label: "Overruns first" },
                    { value: "recent", label: "Recently done" },
                  ]}
                />
              </FilterBar>
            </div>

            {filtered.length === 0 ? (
              <div className="border-t border-[var(--av2-border)]">
                <EmptyState
                  title="No requests match this search"
                  description="Try a different title, creative, company or service."
                  action={<Button onClick={() => setSearch("")}>Clear search</Button>}
                />
              </div>
            ) : (
              <Table label="Logged hours versus estimate per request">
                <thead>
                  <tr>
                    <Th>Request</Th>
                    <Th className="hidden xl:table-cell">Service</Th>
                    <Th className="hidden xl:table-cell">Creative</Th>
                    <Th align="right">Estimated</Th>
                    <Th align="right">Logged</Th>
                    <Th align="right">Variance</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const v = variance(row);
                    const status = TICKET_STATUS[row.status] ?? {
                      label: row.status,
                      tone: "neutral" as Tone,
                    };
                    return (
                      <Tr key={row.ticketId}>
                        <Td>
                          <Link
                            href={`/admin/tickets?ticketId=${row.ticketId}`}
                            className="font-semibold hover:text-[var(--av2-link)] hover:underline"
                          >
                            {row.title}
                          </Link>
                          <div className="text-xs text-[var(--av2-text-2)]">
                            {row.code}
                            {row.company && ` · ${row.company.name}`}
                          </div>
                          <div className="text-xs text-[var(--av2-text-2)] xl:hidden">
                            {row.jobType?.name ?? "No service"} ·{" "}
                            {row.creative?.name || row.creative?.email || "Unassigned"}
                          </div>
                        </Td>
                        <Td className="hidden text-[var(--av2-text-2)] xl:table-cell">
                          {row.jobType?.name ?? DASH}
                        </Td>
                        <Td className="hidden text-[var(--av2-text-2)] xl:table-cell">
                          {row.creative?.name || row.creative?.email || DASH}
                        </Td>
                        <Td align="right">
                          {row.estimatedHours != null ? (
                            formatHours(row.estimatedHours)
                          ) : (
                            <span className="text-[var(--av2-text-2)]" title="No estimate">
                              {DASH}
                            </span>
                          )}
                        </Td>
                        <Td align="right">
                          <div className="font-semibold">{formatHours(row.loggedHours)}</div>
                          <div className="text-xs whitespace-nowrap text-[var(--av2-text-2)]">
                            {fmt(row.entryCount)} {plural(row.entryCount, "entry", "entries")}
                          </div>
                        </Td>
                        <Td align="right">
                          {v ? (
                            <>
                              <Badge tone={v.tone}>{v.text}</Badge>
                              <div className="mt-1 text-xs whitespace-nowrap text-[var(--av2-text-2)]">
                                {v.pct}
                              </div>
                            </>
                          ) : (
                            <span className="text-sm text-[var(--av2-text-2)]">No estimate</span>
                          )}
                        </Td>
                        <Td>
                          <div className="flex flex-col items-start gap-1">
                            <Badge tone={status.tone}>{status.label}</Badge>
                            {row.hasRunningEntry && (
                              <Badge tone="peach" dot>
                                Timer running
                              </Badge>
                            )}
                          </div>
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            )}

            <TableFooter>
              <span className="tabular-nums">
                Showing {fmt(filtered.length)} of {fmt(rows.length)}{" "}
                {plural(rows.length, "request", "requests")}
              </span>
              {search && (
                <Button size="sm" variant="ghost" onClick={() => setSearch("")}>
                  Clear search
                </Button>
              )}
            </TableFooter>
          </Card>
          <div className="mt-6 max-w-2xl">
            <HowItWorks />
          </div>
        </>
      )}
    </>
  );
}
