// -----------------------------------------------------------------------------
// @file: app/admin/designer-analytics/page.tsx
// @purpose: Designer performance analytics page — per-designer metrics table,
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
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DesignerMetrics = {
  id: string;
  name: string | null;
  email: string;
  completedTickets: number;
  activeTickets: number;
  totalTickets: number;
  completionRate: number;
  avgRevisionCount: number;
  avgTurnaroundHours: number;
  loadScore: number;
  totalEarnings: number;
  totalWithdrawn: number;
};

type DesignerAnalyticsResponse = {
  summary: {
    totalDesigners: number;
    totalCompletedTickets: number;
    avgPlatformRevisionRate: number;
    avgPlatformTurnaround: number;
  };
  designers: DesignerMetrics[];
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
  | "completionRate";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "completedTickets", label: "Completed tickets" },
  { value: "completionRate", label: "Completion rate" },
  { value: "avgRevisionCount", label: "Avg revisions" },
  { value: "avgTurnaroundHours", label: "Turnaround time" },
  { value: "loadScore", label: "Load score" },
  { value: "totalEarnings", label: "Earnings" },
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
  "#f15b2b",
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

export default function DesignerAnalyticsPage() {
  const [data, setData] = useState<DesignerAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("completedTickets");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/designer-analytics", {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) {
          if (!cancelled) setError(json?.error ?? "Failed to load.");
          return;
        }
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError("Failed to load designer analytics.");
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
    const list = [...data.designers];
    list.sort((a, b) => {
      if (sortBy === "avgTurnaroundHours") {
        // lower is better — ascending
        return a[sortBy] - b[sortBy];
      }
      // higher is better — descending
      return b[sortBy] - a[sortBy];
    });
    return list;
  }, [data, sortBy]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return [...data.designers]
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
        <LoadingState message="Loading designer analytics…" />
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

  if (!data || data.designers.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <EmptyState
          title="No designers yet."
          description="Designer performance metrics will appear here once designers are assigned to tickets."
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
      <h1 className="mb-1 text-xl font-bold text-[#424143]">
        Designer Performance
      </h1>
      <p className="mb-8 text-sm text-[#9a9892]">
        Per-designer metrics across completion rate, turnaround, revisions, and
        load.
      </p>

      {/* Summary cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: "Active Designers",
            value: summary.totalDesigners,
            accent: "#3B82F6",
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
            accent: "#f15b2b",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="relative overflow-hidden rounded-2xl border border-[#e3e1dc] bg-white px-5 py-5 shadow-sm"
          >
            <div
              className="absolute left-0 top-0 h-1 w-full"
              style={{ background: card.accent }}
            />
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b1afa9]">
              {card.label}
            </p>
            <p className="mt-1 text-2xl font-bold text-[#424143]">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Chart — completed tickets per designer */}
      {chartData.length > 0 && (
        <div className="mb-8 rounded-2xl border border-[#e3e1dc] bg-white px-5 py-5 shadow-sm">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b1afa9]">
            Completed Tickets by Designer
          </p>
          <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 36)}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 12, bottom: 0, left: 0 }}
            >
              <XAxis type="number" tick={{ fontSize: 10, fill: "#9a9892" }} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: "#424143" }}
                width={100}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 11,
                  borderRadius: 8,
                  border: "1px solid #e3e1dc",
                }}
              />
              <Bar dataKey="completed" radius={[0, 4, 4, 0]} barSize={20}>
                {chartData.map((_entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={BAR_COLORS[index % BAR_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Sort control */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-[#424143]">
          All Designers ({data.designers.length})
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

      {/* Designer table */}
      <div className="overflow-x-auto rounded-2xl border border-[#e3e1dc] bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#f0eee9] bg-[#fbfaf8] text-[10px] font-semibold uppercase tracking-[0.12em] text-[#b1afa9]">
              <th className="px-4 py-3">Designer</th>
              <th className="px-3 py-3 text-center">Completed</th>
              <th className="px-3 py-3 text-center">Active</th>
              <th className="px-3 py-3 text-center">Rate</th>
              <th className="px-3 py-3 text-center">Avg Rev.</th>
              <th className="px-3 py-3 text-center">Turnaround</th>
              <th className="px-3 py-3 text-center">Earnings</th>
              <th className="px-3 py-3 text-center">Load</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((d) => (
              <tr
                key={d.id}
                className="border-b border-[#f5f3f0] transition-colors hover:bg-[#fbfaf8]"
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-[#424143]">
                    {d.name || "—"}
                  </p>
                  <p className="text-[10px] text-[#9a9892]">{d.email}</p>
                </td>
                <td className="px-3 py-3 text-center font-semibold text-[#424143]">
                  {d.completedTickets}
                </td>
                <td className="px-3 py-3 text-center text-[#9a9892]">
                  {d.activeTickets}
                </td>
                <td className="px-3 py-3 text-center">
                  <span
                    className={`font-semibold ${
                      d.completionRate >= 80
                        ? "text-[#22C55E]"
                        : d.completionRate >= 50
                          ? "text-[#F59E0B]"
                          : "text-[#9a9892]"
                    }`}
                  >
                    {d.completionRate}%
                  </span>
                </td>
                <td className="px-3 py-3 text-center text-[#424143]">
                  {d.avgRevisionCount > 0 ? d.avgRevisionCount.toFixed(1) : "—"}
                </td>
                <td className="px-3 py-3 text-center text-[#424143]">
                  {formatHours(d.avgTurnaroundHours)}
                </td>
                <td className="px-3 py-3 text-center font-medium text-[#424143]">
                  {d.totalEarnings > 0 ? d.totalEarnings.toLocaleString() : "—"}
                  <span className="ml-0.5 text-[10px] text-[#9a9892]">
                    {d.totalEarnings > 0 ? "tkn" : ""}
                  </span>
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
