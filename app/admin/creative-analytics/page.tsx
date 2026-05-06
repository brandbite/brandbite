// -----------------------------------------------------------------------------
// @file: app/admin/creative-analytics/page.tsx
// @purpose: Creative performance analytics page — per-creative metrics table,
//           summary cards, and completion chart for admin
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-12-15
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import { InlineAlert } from "@/components/ui/inline-alert";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { FormSelect } from "@/components/ui/form-field";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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

function loadScoreColor(score: number): string {
  if (score >= 80) return "#EF4444";
  if (score >= 50) return "#F59E0B";
  return "#22C55E";
}

function formatHours(hours: number): string {
  if (hours === 0) return "—";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

// ---------------------------------------------------------------------------
// Chart colors
// ---------------------------------------------------------------------------

const BAR_COLORS = [
  "var(--bb-primary)",
  "#3B82F6",
  "#22C55E",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#64748B",
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CreativeAnalyticsPage() {
  const [data, setData] = useState<CreativeAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("completedTickets");

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

  const chartData = useMemo(() => {
    if (!data) return [];
    return [...data.creatives]
      .sort((a, b) => b.completedTickets - a.completedTickets)
      .slice(0, 12)
      .map((d) => ({
        name: d.name || d.email.split("@")[0],
        completed: d.completedTickets,
      }));
  }, [data]);

  // -------------------------------------------------------------------------
  // Loading / Error
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <LoadingState message="Loading creative analytics…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <InlineAlert variant="error">{error}</InlineAlert>
      </div>
    );
  }

  if (!data || data.creatives.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <EmptyState
          title="No creatives yet."
          description="Creative performance metrics will appear here once creatives are assigned to tickets."
        />
      </div>
    );
  }

  const { summary } = data;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* Header */}
      <h1 className="mb-1 text-xl font-bold text-[var(--bb-secondary)]">Creative Performance</h1>
      <p className="mb-8 text-sm text-[var(--bb-text-tertiary)]">
        Per-creative metrics across completion rate, turnaround, revisions, and load.
      </p>

      {/* Summary cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {[
          {
            label: "Active Creatives",
            value:
              summary.pausedCount > 0
                ? `${summary.totalCreatives - summary.pausedCount} / ${summary.totalCreatives}`
                : summary.totalCreatives,
            accent: "#3B82F6",
            hint: summary.pausedCount > 0 ? `${summary.pausedCount} paused` : undefined,
          },
          {
            label: "Total Completed",
            value: summary.totalCompletedTickets,
            accent: "#22C55E",
          },
          {
            label: "Avg Revisions / Ticket",
            value: summary.avgPlatformRevisionRate.toFixed(1),
            accent: "#F59E0B",
          },
          {
            label: "Avg Turnaround",
            value: formatHours(summary.avgPlatformTurnaround),
            accent: "var(--bb-primary)",
          },
          {
            label: "Max Load Score",
            value: summary.maxLoadScore,
            accent: "#EF4444",
            hint: "Team peak — utilization bars normalize to this.",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="relative overflow-hidden rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-5 shadow-sm"
          >
            <div className="absolute top-0 left-0 h-1 w-full" style={{ background: card.accent }} />
            <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--bb-text-muted)] uppercase">
              {card.label}
            </p>
            <p className="mt-1 text-2xl font-bold text-[var(--bb-secondary)]">{card.value}</p>
            {"hint" in card && card.hint && (
              <p className="mt-1 text-[10px] text-[var(--bb-text-tertiary)]">{card.hint}</p>
            )}
          </div>
        ))}
      </div>

      {/* Chart — completed tickets per creative */}
      {chartData.length > 0 && (
        <div className="mb-8 rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-5 shadow-sm">
          <p className="mb-3 text-[11px] font-semibold tracking-[0.14em] text-[var(--bb-text-muted)] uppercase">
            Completed Tickets by Creative
          </p>
          <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 36)}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 12, bottom: 0, left: 0 }}
            >
              <XAxis type="number" tick={{ fontSize: 10, fill: "var(--bb-text-tertiary)" }} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: "var(--bb-secondary)" }}
                width={100}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 11,
                  borderRadius: 8,
                  border: "1px solid var(--bb-border)",
                }}
              />
              <Bar dataKey="completed" radius={[0, 4, 4, 0]} barSize={20}>
                {chartData.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Sort control */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--bb-secondary)]">
          All Creatives ({data.creatives.length})
        </p>
        <FormSelect
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="w-44"
          size="sm"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </FormSelect>
      </div>

      {/* Creative table */}
      <div className="overflow-x-auto rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] shadow-sm">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--bb-border-subtle)] bg-[var(--bb-bg-page)] text-[10px] font-semibold tracking-[0.12em] text-[var(--bb-text-muted)] uppercase">
              <th className="px-4 py-3">Creative</th>
              <th className="px-3 py-3 text-center">Completed</th>
              <th className="px-3 py-3 text-center">Active (T / IP / IR)</th>
              <th
                className="px-3 py-3 text-center"
                title="Concurrent task cap (auto-assign skips this creative when active reaches the cap) and tasks completed in the current ISO week"
              >
                Capacity
              </th>
              <th className="px-3 py-3 text-center">Rate</th>
              <th className="px-3 py-3 text-center">Avg Rev.</th>
              <th className="px-3 py-3 text-center">Turnaround</th>
              <th className="px-3 py-3 text-center">Rating</th>
              <th className="px-3 py-3 text-center">Earnings</th>
              <th className="px-3 py-3 text-center">Utilization</th>
              <th className="px-3 py-3 text-center">Load</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((d) => (
              <tr
                key={d.id}
                className="border-b border-[var(--bb-bg-card)] transition-colors hover:bg-[var(--bb-bg-page)]"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-[var(--bb-secondary)]">{d.name || "—"}</p>
                      <p className="truncate text-[10px] text-[var(--bb-text-tertiary)]">
                        {d.email}
                      </p>
                      {d.workingHours && (
                        <p
                          className="truncate text-[10px] text-[var(--bb-text-muted)]"
                          title={d.workingHours}
                        >
                          ⌚ {d.workingHours}
                        </p>
                      )}
                    </div>
                    {d.isPaused && (
                      <span
                        className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-900"
                        title={
                          d.pauseExpiresAt
                            ? `Paused until ${new Date(d.pauseExpiresAt).toLocaleDateString()}`
                            : "Paused (no expiry)"
                        }
                      >
                        Paused
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 text-center font-semibold text-[var(--bb-secondary)]">
                  {d.completedTickets}
                </td>
                <td className="px-3 py-3 text-center">
                  <span className="font-medium text-[var(--bb-secondary)]">{d.activeTickets}</span>
                  <span className="ml-1 font-mono text-[10px] text-[var(--bb-text-tertiary)]">
                    ({d.statusBreakdown.TODO} / {d.statusBreakdown.IN_PROGRESS} /{" "}
                    {d.statusBreakdown.IN_REVIEW})
                  </span>
                </td>
                <td className="px-3 py-3 text-center">
                  {/* Capacity column. Top: active vs cap (the auto-
                      assign filter); bottom: completed in the current
                      ISO week (a productivity hint, distinct from the
                      lifetime "Completed" column on the left). */}
                  <div
                    className="leading-tight"
                    title={
                      d.tasksPerWeekCap == null
                        ? `${d.activeTickets} active. No cap. ${d.completedThisWeek} done this week.`
                        : d.activeTickets >= d.tasksPerWeekCap
                          ? `${d.activeTickets} / ${d.tasksPerWeekCap} active. AT CAP — auto-assign will skip until this drops. ${d.completedThisWeek} done this week.`
                          : `${d.activeTickets} / ${d.tasksPerWeekCap} active. ${d.tasksPerWeekCap - d.activeTickets} slots free. ${d.completedThisWeek} done this week.`
                    }
                  >
                    <span
                      className={`font-semibold ${
                        d.tasksPerWeekCap != null && d.activeTickets >= d.tasksPerWeekCap
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-[var(--bb-secondary)]"
                      }`}
                    >
                      {d.activeTickets}
                      <span className="text-[var(--bb-text-tertiary)]">
                        {" "}
                        / {d.tasksPerWeekCap == null ? "—" : d.tasksPerWeekCap}
                      </span>
                    </span>
                    <p className="text-[10px] text-[var(--bb-text-muted)]">
                      {d.completedThisWeek} this wk
                    </p>
                  </div>
                </td>
                <td className="px-3 py-3 text-center">
                  <span
                    className={`font-semibold ${
                      d.completionRate >= 80
                        ? "text-[#22C55E]"
                        : d.completionRate >= 50
                          ? "text-[#F59E0B]"
                          : "text-[var(--bb-text-tertiary)]"
                    }`}
                  >
                    {d.completionRate}%
                  </span>
                </td>
                <td className="px-3 py-3 text-center text-[var(--bb-secondary)]">
                  {d.avgRevisionCount > 0 ? d.avgRevisionCount.toFixed(1) : "—"}
                </td>
                <td className="px-3 py-3 text-center text-[var(--bb-secondary)]">
                  {formatHours(d.avgTurnaroundHours)}
                </td>
                <td className="px-3 py-3 text-center">
                  {d.ratingOverall !== null ? (
                    <span
                      title={`Quality ${d.ratingQuality?.toFixed(1)} · Communication ${d.ratingCommunication?.toFixed(1)} · Speed ${d.ratingSpeed?.toFixed(1)} — ${d.ratingCount} rating${d.ratingCount === 1 ? "" : "s"}`}
                    >
                      <span className="font-semibold text-[var(--bb-secondary)]">
                        {d.ratingOverall.toFixed(1)}
                      </span>
                      <span className="ml-1 text-[10px] text-[var(--bb-text-tertiary)]">
                        / 5 · n={d.ratingCount}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[var(--bb-text-tertiary)]">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-center font-medium text-[var(--bb-secondary)]">
                  {d.totalEarnings > 0 ? d.totalEarnings.toLocaleString() : "—"}
                  <span className="ml-0.5 text-[10px] text-[var(--bb-text-tertiary)]">
                    {d.totalEarnings > 0 ? "tkn" : ""}
                  </span>
                </td>
                <td className="px-3 py-3">
                  {(() => {
                    const max = data?.summary.maxLoadScore ?? 0;
                    const pct = max > 0 ? Math.round((d.loadScore / max) * 100) : 0;
                    return (
                      <div className="flex items-center gap-2">
                        <div className="h-2 min-w-[60px] flex-1 overflow-hidden rounded-full bg-[var(--bb-bg-card)]">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.max(3, pct)}%`,
                              backgroundColor: loadScoreColor(d.loadScore),
                            }}
                            aria-label={`${pct}% of team's max load`}
                          />
                        </div>
                        <span className="w-9 text-right font-mono text-[10px] text-[var(--bb-text-tertiary)]">
                          {pct}%
                        </span>
                      </div>
                    );
                  })()}
                </td>
                <td className="px-3 py-3 text-center">
                  <span
                    className="inline-flex min-w-[32px] items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                    style={{
                      backgroundColor: loadScoreColor(d.loadScore),
                    }}
                  >
                    {d.loadScore}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
