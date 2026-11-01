// -----------------------------------------------------------------------------
// @file: app/admin/creative-analytics/page.tsx
// @purpose: Creative performance (admin design language v1). Comparative
//           table of creatives with a relative-load bar, an explainer for how
//           relative load is derived, and a detail panel for the selected
//           creative. The old "completed tickets" bar chart duplicated the
//           table's Completed column and was removed.
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-11-01
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  CardTitle,
  DASH,
  DetailPanel,
  EmptyState,
  FilterBar,
  KeyValueList,
  KpiCard,
  PageHeader,
  PanelSection,
  SearchInput,
  Select,
  Skeleton,
  SplitView,
  StatusDot,
  Table,
  TableFooter,
  Td,
  TextLink,
  Th,
  Tr,
  fmt,
  plural,
} from "@/components/admin/v2/ui";
import { IconClock, IconDocument, IconUsers } from "@/components/admin/v2/icons";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CreativeMetrics = {
  id: string;
  name: string | null;
  email: string;
  isPaused: boolean;
  pauseExpiresAt: string | null;
  completedTickets: number;
  activeTickets: number;
  statusBreakdown: { TODO: number; IN_PROGRESS: number; IN_REVIEW: number };
  totalTickets: number;
  completionRate: number;
  avgRevisionCount: number;
  avgTurnaroundHours: number;
  loadScore: number;
  totalEarnings: number;
  totalWithdrawn: number;
  /** Customer ratings (admin-only; creatives don't see these). null when no ratings yet. */
  ratingCount: number;
  ratingOverall: number | null;
  ratingQuality: number | null;
  ratingCommunication: number | null;
  ratingSpeed: number | null;
  // Workload PR
  workingHours: string | null;
  tasksPerWeekCap: number | null;
  completedThisWeek: number;
};

type CreativeAnalyticsResponse = {
  summary: {
    totalCreatives: number;
    totalCompletedTickets: number;
    avgPlatformRevisionRate: number;
    avgPlatformTurnaround: number;
    maxLoadScore: number;
    pausedCount: number;
  };
  creatives: CreativeMetrics[];
};

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

type SortKey =
  | "completedTickets"
  | "avgTurnaroundHours"
  | "avgRevisionCount"
  | "loadScore"
  | "totalEarnings"
  | "completionRate"
  | "ratingOverall";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "completedTickets", label: "Completed tickets" },
  { value: "completionRate", label: "Completion rate" },
  { value: "avgRevisionCount", label: "Avg revisions" },
  { value: "avgTurnaroundHours", label: "Turnaround time" },
  { value: "loadScore", label: "Load score" },
  { value: "totalEarnings", label: "Earnings" },
  { value: "ratingOverall", label: "Avg rating" },
];

// ---------------------------------------------------------------------------
// Formatting — the API sends 0 for "no data" on averages, so each helper
// maps that back to a dash instead of a misleading zero.
// ---------------------------------------------------------------------------

/** Average review turnaround. 0 from the API means "no measured revisions". */
function formatTurnaround(hours: number): string {
  if (!hours) return DASH;
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${Math.round(hours)} h`;
  const days = Math.round(hours / 24);
  return `${days} ${plural(days, "day", "days")}`;
}

const displayName = (c: CreativeMetrics) => c.name || c.email.split("@")[0];

/** Load score as a share of the team peak. null when the whole team is idle. */
function relativeLoad(score: number, max: number): number | null {
  if (max <= 0) return null;
  return Math.round((score / max) * 100);
}

const avgRevisions = (c: CreativeMetrics) =>
  c.completedTickets > 0 ? c.avgRevisionCount.toFixed(1) : DASH;

const completion = (c: CreativeMetrics) => (c.totalTickets > 0 ? `${c.completionRate}%` : DASH);

const atCap = (c: CreativeMetrics) =>
  c.tasksPerWeekCap != null && c.activeTickets >= c.tasksPerWeekCap;

// ---------------------------------------------------------------------------
// Local glyphs
// ---------------------------------------------------------------------------

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

const IconCheckCircle = () => (
  <Glyph>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12 2.5 2.5 4.5-5" />
  </Glyph>
);

const IconChevronRight = () => (
  <Glyph>
    <path d="m9 6 6 6-6 6" />
  </Glyph>
);

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

function LoadBar({ pct, score }: { pct: number | null; score: number }) {
  const scoreLine = (
    <div className="mt-1 text-xs whitespace-nowrap text-[var(--av2-text-2)]">
      Load score {fmt(score)}
    </div>
  );
  if (pct === null) {
    return (
      <>
        <span className="text-[var(--av2-text-2)]">{DASH}</span>
        {scoreLine}
      </>
    );
  }
  return (
    <>
      <div className="flex items-center justify-end gap-3">
        <div
          role="img"
          aria-label={`${pct}% of the team peak load score`}
          className="h-2 w-16 shrink-0 overflow-hidden rounded-full bg-[var(--av2-track)]"
        >
          <div
            className="h-full rounded-full bg-[var(--av2-fill-lavender)]"
            style={{ width: `${Math.min(100, Math.max(pct > 0 ? 3 : 0, pct))}%` }}
          />
        </div>
        <span className="w-11 text-right font-semibold tabular-nums">{pct}%</span>
      </div>
      {scoreLine}
    </>
  );
}

function RatingValue({ c }: { c: CreativeMetrics }) {
  if (c.ratingOverall === null) {
    return <span className="whitespace-nowrap text-[var(--av2-text-2)]">No ratings</span>;
  }
  return (
    <span className="whitespace-nowrap">
      <span className="font-semibold">{c.ratingOverall.toFixed(1)}</span>
      <span className="text-[var(--av2-text-2)]"> / 5</span>
      <span className="block text-xs text-[var(--av2-text-2)]">
        {fmt(c.ratingCount)} {plural(c.ratingCount, "rating", "ratings")}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CreativeAnalyticsPage() {
  const [data, setData] = useState<CreativeAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("completedTickets");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/creative-analytics", {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) {
          if (!cancelled) setError(json?.error ?? "Failed to load.");
          return;
        }
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError("Failed to load creative analytics.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = useMemo(() => {
    if (!data) return [];
    const list = [...data.creatives];
    list.sort((a, b) => {
      if (sortBy === "avgTurnaroundHours") {
        // lower is better — ascending
        return a[sortBy] - b[sortBy];
      }
      if (sortBy === "ratingOverall") {
        // null (no ratings yet) sorts to the bottom; otherwise higher is better
        const av = a.ratingOverall ?? -Infinity;
        const bv = b.ratingOverall ?? -Infinity;
        return bv - av;
      }
      // higher is better — descending
      return b[sortBy] - a[sortBy];
    });
    return list;
  }, [data, sortBy]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter((c) => `${c.name ?? ""} ${c.email}`.toLowerCase().includes(needle));
  }, [sorted, query]);

  const summary = data?.summary;
  const creatives = data?.creatives ?? [];
  const maxLoad = summary?.maxLoadScore ?? 0;
  const pending = loading && !data;
  const selected = creatives.find((c) => c.id === selectedId) ?? null;
  // With the detail panel open the list column narrows; rating moves to the
  // panel so the comparison columns stay visible without horizontal scroll.
  const compact = selected !== null;

  // -------------------------------------------------------------------------
  // Detail panel
  // -------------------------------------------------------------------------

  const panel = selected ? (
    <DetailPanel
      title="Creative details"
      onClose={() => setSelectedId(null)}
      closeLabel="Close creative details"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-[var(--av2-text-2)]">Profile, pause and workload cap</span>
          <TextLink href={`/admin/users/${selected.id}`}>Open user profile</TextLink>
        </div>
      }
    >
      <div className="flex items-center gap-4">
        <Avatar name={selected.name || selected.email} size={56} tone="lavender" />
        <div className="min-w-0">
          <p className="truncate text-2xl leading-8 font-bold">{selected.name || DASH}</p>
          <p className="truncate text-sm text-[var(--av2-text-2)]">{selected.email}</p>
        </div>
      </div>
      {(selected.isPaused || selected.workingHours) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {selected.isPaused && (
            <Badge tone="amber" dot>
              {selected.pauseExpiresAt
                ? `Paused until ${new Date(selected.pauseExpiresAt).toLocaleDateString()}`
                : "Paused · no end date"}
            </Badge>
          )}
          {selected.workingHours && (
            <span className="inline-flex items-center gap-1.5 text-sm text-[var(--av2-text-2)]">
              <IconClock width={16} height={16} className="shrink-0" />
              {selected.workingHours}
            </span>
          )}
        </div>
      )}

      <div className="mt-6">
        <PanelSection title="Delivery">
          <KeyValueList
            rows={[
              {
                label: "Completed tickets",
                value: <span className="tabular-nums">{fmt(selected.completedTickets)}</span>,
              },
              {
                label: "Completed this week",
                value: <span className="tabular-nums">{fmt(selected.completedThisWeek)}</span>,
              },
              {
                label: "Completion rate",
                value: (
                  <span className="tabular-nums">
                    {completion(selected)}
                    {selected.totalTickets > 0 && (
                      <span className="font-normal text-[var(--av2-text-2)]">
                        {" "}
                        of {fmt(selected.totalTickets)} assigned
                      </span>
                    )}
                  </span>
                ),
              },
              {
                label: "Avg revisions / ticket",
                value: <span className="tabular-nums">{avgRevisions(selected)}</span>,
              },
              {
                label: "Avg review turnaround",
                value: (
                  <span className="tabular-nums">
                    {formatTurnaround(selected.avgTurnaroundHours)}
                  </span>
                ),
              },
            ]}
          />
        </PanelSection>

        <PanelSection title="Customer rating">
          {selected.ratingOverall === null ? (
            <p className="text-sm text-[var(--av2-text-2)]">No ratings yet</p>
          ) : (
            <>
              <p className="text-sm">
                <span className="text-2xl leading-8 font-bold tabular-nums">
                  {selected.ratingOverall.toFixed(1)}
                </span>
                <span className="text-[var(--av2-text-2)]">
                  {" "}
                  / 5 · {fmt(selected.ratingCount)}{" "}
                  {plural(selected.ratingCount, "rating", "ratings")}
                </span>
              </p>
              <div className="mt-3">
                <KeyValueList
                  rows={[
                    { label: "Quality", value: selected.ratingQuality },
                    { label: "Communication", value: selected.ratingCommunication },
                    { label: "Speed", value: selected.ratingSpeed },
                  ].map((r) => ({
                    label: r.label,
                    value: (
                      <span className="tabular-nums">
                        {r.value === null ? DASH : `${r.value.toFixed(1)} / 5`}
                      </span>
                    ),
                  }))}
                />
              </div>
            </>
          )}
          <p className="mt-3 text-xs text-[var(--av2-text-2)]">
            Admin only — creatives don&apos;t see their ratings.
          </p>
        </PanelSection>

        <PanelSection
          title={
            <>
              Current work{" "}
              <span className="font-normal text-[var(--av2-text-2)]">
                ({fmt(selected.activeTickets)} active)
              </span>
            </>
          }
        >
          <ul className="space-y-3">
            {(
              [
                { key: "TODO", label: "Backlog", tone: "neutral" },
                { key: "IN_PROGRESS", label: "In progress", tone: "lavender" },
                { key: "IN_REVIEW", label: "In review", tone: "peach" },
              ] as const
            ).map((s) => {
              const n = selected.statusBreakdown[s.key];
              const pct = selected.activeTickets > 0 ? (n / selected.activeTickets) * 100 : 0;
              return (
                <li key={s.key} className="grid grid-cols-[8rem_2rem_1fr] items-center gap-3">
                  <StatusDot tone={s.tone} label={s.label} />
                  <span className="text-right text-sm tabular-nums">{fmt(n)}</span>
                  <span
                    aria-hidden
                    className="h-2 overflow-hidden rounded-full bg-[var(--av2-track)]"
                  >
                    <span
                      className="block h-full rounded-full bg-[var(--av2-fill-lavender)]"
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        </PanelSection>

        <PanelSection title="Workload">
          <KeyValueList
            rows={[
              {
                label: "Load score",
                value: <span className="tabular-nums">{fmt(selected.loadScore)}</span>,
              },
              {
                label: "Relative load",
                value: (
                  <span className="tabular-nums">
                    {relativeLoad(selected.loadScore, maxLoad) === null
                      ? DASH
                      : `${relativeLoad(selected.loadScore, maxLoad)}% of team peak`}
                  </span>
                ),
              },
              {
                label: "Concurrent task cap",
                value:
                  selected.tasksPerWeekCap == null ? (
                    <span className="text-[var(--av2-text-2)]">Not set</span>
                  ) : (
                    <span className="flex flex-wrap items-center gap-2 tabular-nums">
                      {fmt(selected.activeTickets)} / {fmt(selected.tasksPerWeekCap)} active
                      {atCap(selected) && <Badge tone="amber">At cap</Badge>}
                    </span>
                  ),
              },
            ]}
          />
          <p className="mt-3 text-xs text-[var(--av2-text-2)]">
            {selected.tasksPerWeekCap == null
              ? "No cap configured — auto-assign does not limit this creative."
              : atCap(selected)
                ? "Auto-assign skips this creative until an active ticket is completed."
                : `${fmt(selected.tasksPerWeekCap - selected.activeTickets)} ${plural(
                    selected.tasksPerWeekCap - selected.activeTickets,
                    "slot",
                    "slots",
                  )} free before auto-assign skips this creative.`}
          </p>
        </PanelSection>

        <PanelSection title="Tokens">
          <KeyValueList
            rows={[
              {
                label: "Earned",
                value: <span className="tabular-nums">{fmt(selected.totalEarnings)} tokens</span>,
              },
              {
                label: "Withdrawn",
                value: <span className="tabular-nums">{fmt(selected.totalWithdrawn)} tokens</span>,
              },
            ]}
          />
        </PanelSection>
      </div>
    </DetailPanel>
  ) : null;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const activeCreatives = summary ? summary.totalCreatives - summary.pausedCount : null;

  return (
    <>
      <PageHeader
        title="Creative performance"
        description="Compare delivery, current workload and token earnings."
      />

      {error && (
        <div className="mb-6">
          <Callout tone="error" title="Something went wrong">
            {error}
          </Callout>
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<IconUsers />}
          tone="lavender"
          label="Active creatives"
          value={
            !summary
              ? DASH
              : summary.pausedCount > 0
                ? `${fmt(activeCreatives)} / ${fmt(summary.totalCreatives)}`
                : fmt(summary.totalCreatives)
          }
          hint={
            summary && summary.pausedCount > 0
              ? `${fmt(summary.pausedCount)} paused`
              : "None paused"
          }
        />
        <KpiCard
          icon={<IconCheckCircle />}
          tone="green"
          label="Completed tickets"
          value={fmt(summary?.totalCompletedTickets)}
          hint="All time, across the team"
        />
        <KpiCard
          icon={<IconDocument />}
          tone="peach"
          label="Avg revisions / ticket"
          value={
            summary && summary.totalCompletedTickets > 0
              ? summary.avgPlatformRevisionRate.toFixed(1)
              : DASH
          }
          hint={
            summary && summary.totalCompletedTickets === 0
              ? "No completed tickets yet"
              : "Completed tickets only"
          }
        />
        <KpiCard
          icon={<IconClock />}
          tone="lavender"
          label="Avg review turnaround"
          value={summary ? formatTurnaround(summary.avgPlatformTurnaround) : DASH}
          hint={
            summary && !summary.avgPlatformTurnaround
              ? "No reviewed revisions yet"
              : "Revision submitted → customer feedback"
          }
        />
      </div>

      <SplitView panel={panel}>
        <Card padding="none">
          <div className="px-6 pt-5">
            <div className="mb-4">
              <CardTitle
                action={
                  data ? (
                    <span className="pt-1 text-sm whitespace-nowrap text-[var(--av2-text-2)] tabular-nums">
                      {fmt(creatives.length)} {plural(creatives.length, "creative", "creatives")}
                    </span>
                  ) : null
                }
                description="Select a creative to see delivery, rating and workload details."
              >
                Creatives
              </CardTitle>
            </div>
            <FilterBar>
              <SearchInput
                className="min-w-[200px] flex-1"
                value={query}
                onChange={setQuery}
                placeholder="Search creatives"
                label="Search creatives by name or email"
              />
              <div className="w-full sm:w-52">
                <Select
                  aria-label="Sort creatives by"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortKey)}
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      Sort: {o.label}
                    </option>
                  ))}
                </Select>
              </div>
            </FilterBar>
          </div>

          {pending ? (
            <div className="space-y-3 border-t border-[var(--av2-border)] px-6 py-5" role="status">
              <span className="sr-only">Loading creative analytics…</span>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !data ? null : creatives.length === 0 ? (
            <div className="border-t border-[var(--av2-border)]">
              <EmptyState
                icon={<IconUsers width={28} height={28} />}
                title="No creatives yet"
                description="Creative performance metrics appear here once creatives are assigned to tickets."
              />
            </div>
          ) : visible.length === 0 ? (
            <div className="border-t border-[var(--av2-border)]">
              <EmptyState
                title="No creatives match this search"
                description="Try a different name or email."
                action={<Button onClick={() => setQuery("")}>Clear search</Button>}
              />
            </div>
          ) : (
            <Table label="Creative performance">
              <thead>
                <tr>
                  <Th>Creative</Th>
                  <Th align="right">Completed</Th>
                  <Th align="right">Active</Th>
                  <Th align="right">Completion</Th>
                  {!compact && (
                    <Th align="right" className="hidden xl:table-cell">
                      Rating
                    </Th>
                  )}
                  <Th align="right">Relative load</Th>
                  {!compact && (
                    <Th align="right" className="hidden xl:table-cell">
                      <span className="sr-only">Open</span>
                    </Th>
                  )}
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => {
                  const rel = relativeLoad(c.loadScore, maxLoad);
                  return (
                    <Tr
                      key={c.id}
                      selected={c.id === selectedId}
                      onSelect={() => setSelectedId(c.id)}
                      label={`${displayName(c)}, ${fmt(c.activeTickets)} active, relative load ${
                        rel === null ? "not available" : `${rel}%`
                      }`}
                    >
                      <Td className={compact ? "max-w-[13rem]" : undefined}>
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={c.name || c.email}
                            size={compact ? 32 : 40}
                            tone="lavender"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-semibold">{c.name || DASH}</span>
                              {c.isPaused && <Badge tone="amber">Paused</Badge>}
                            </div>
                            <div className="truncate text-xs text-[var(--av2-text-2)]">
                              {c.email}
                            </div>
                          </div>
                        </div>
                      </Td>
                      <Td align="right">{fmt(c.completedTickets)}</Td>
                      <Td align="right">
                        <div>{fmt(c.activeTickets)}</div>
                        <div className="text-xs whitespace-nowrap text-[var(--av2-text-2)]">
                          {c.tasksPerWeekCap == null ? "No cap" : `Cap ${fmt(c.tasksPerWeekCap)}`}
                        </div>
                        {atCap(c) && <Badge tone="amber">At cap</Badge>}
                      </Td>
                      <Td align="right">{completion(c)}</Td>
                      {!compact && (
                        <Td align="right" className="hidden xl:table-cell">
                          <RatingValue c={c} />
                        </Td>
                      )}
                      <Td align="right">
                        <LoadBar pct={rel} score={c.loadScore} />
                      </Td>
                      {!compact && (
                        <Td align="right" className="hidden text-[var(--av2-text-2)] xl:table-cell">
                          <span className="inline-flex">
                            <IconChevronRight />
                          </span>
                        </Td>
                      )}
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          )}

          {data && creatives.length > 0 && (
            <>
              <div className="border-t border-[var(--av2-border)] px-6 py-5">
                <Callout title="Relative load compares creatives with each other, not with their capacity">
                  Load score adds up every active (not done) ticket as priority weight (Low 1,
                  Medium 2, High 3, Urgent 4) × the job type&apos;s token cost. Relative load = load
                  score ÷ the team peak load score
                  {maxLoad > 0 ? ` (${fmt(maxLoad)})` : ""} × 100, so the busiest creative is always
                  100%.{" "}
                  {maxLoad === 0 &&
                    "No creative has active tickets right now, so relative load is not shown. "}
                  It is not capacity utilisation — concurrent task caps are set per creative in
                  their user profile.
                </Callout>
              </div>
              <TableFooter>
                <span className="tabular-nums">
                  Showing {fmt(visible.length)} of {fmt(creatives.length)}{" "}
                  {plural(creatives.length, "creative", "creatives")}
                </span>
                {query && (
                  <Button size="sm" variant="ghost" onClick={() => setQuery("")}>
                    Clear search
                  </Button>
                )}
              </TableFooter>
            </>
          )}
        </Card>
      </SplitView>
    </>
  );
}
