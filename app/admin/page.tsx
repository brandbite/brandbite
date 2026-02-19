// -----------------------------------------------------------------------------
// @file: app/admin/page.tsx
// @purpose: Admin analytics dashboard — platform-wide metrics, charts, health
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-25
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingState } from "@/components/ui/loading-state";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";

type TicketStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type AdminDashboardResponse = {
  platform: {
    totalCompanies: number;
    activeCompanies: number;
    totalDesigners: number;
    totalTickets: number;
    ticketsByStatus: Record<TicketStatus, number>;
    ticketsByPriority: Record<TicketPriority, number>;
    ticketsCreatedLast30Days: number;
    ticketsCompletedLast30Days: number;
    avgRevisionCount: number;
  };
  tokens: {
    globalCredits: number;
    globalDebits: number;
    globalNet: number;
    totalCompanyBalances: number;
  };
  withdrawals: {
    pendingCount: number;
    pendingAmount: number;
    totalPaid: number;
  };
  health: {
    companiesLowBalance: number;
    overdueTickets: number;
    staleTickets: number;
  };
};

type DashboardState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: AdminDashboardResponse };

/* Status accent colors for chart bars */
const STATUS_COLORS: Record<TicketStatus, string> = {
  TODO: "#9CA3AF",
  IN_PROGRESS: "#3B82F6",
  IN_REVIEW: "#F15B2B",
  DONE: "#22C55E",
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  TODO: "Backlog",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  DONE: "Done",
};

const STATUS_ORDER: TicketStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];

/* Priority accent colors */
const PRIORITY_COLORS: Record<TicketPriority, string> = {
  URGENT: "#EF4444",
  HIGH: "#F59E0B",
  MEDIUM: "#3B82F6",
  LOW: "#9CA3AF",
};

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  URGENT: "Urgent",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

const PRIORITY_ORDER: TicketPriority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];

export default function AdminDashboardPage() {
  const [state, setState] = useState<DashboardState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setState({ status: "loading" });

      try {
        const res = await fetch("/api/admin/dashboard", { cache: "no-store" });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(
            (json as any)?.error ??
              `Dashboard request failed with status ${res.status}`,
          );
        }

        if (cancelled) return;

        setState({
          status: "ready",
          data: json as AdminDashboardResponse,
        });
      } catch (err: any) {
        console.error("[AdminDashboard] load error", err);
        if (!cancelled) {
          setState({
            status: "error",
            message:
              err?.message ?? "Failed to load admin dashboard. Please try again.",
          });
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const isLoading = state.status === "loading";
  const isError = state.status === "error";
  const data = state.status === "ready" ? state.data : null;

  const platform = data?.platform ?? null;
  const tokens = data?.tokens ?? null;
  const withdrawals = data?.withdrawals ?? null;
  const health = data?.health ?? null;

  /* Chart data */
  const statusChartData = platform
    ? STATUS_ORDER.map((s) => ({
        name: STATUS_LABELS[s],
        count: platform.ticketsByStatus[s] ?? 0,
        fill: STATUS_COLORS[s],
      }))
    : [];

  const priorityChartData = platform
    ? PRIORITY_ORDER.map((p) => ({
        name: PRIORITY_LABELS[p],
        count: platform.ticketsByPriority[p] ?? 0,
        fill: PRIORITY_COLORS[p],
      }))
    : [];

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b1afa9]">
            Admin
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Dashboard
          </h1>
          <p className="mt-1 text-xs text-[#9a9892]">
            Platform-wide analytics and health overview.
          </p>
        </div>
        {isLoading && (
          <LoadingState display="inline" message="Loading dashboard..." />
        )}
      </div>

      {/* Error */}
      {isError && (
        <InlineAlert variant="error" title="Something went wrong" className="mb-4">
          {state.message}
        </InlineAlert>
      )}

      {/* Content */}
      {!isError && (
        <div className="space-y-4">
          {/* Row 1: Platform overview cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Companies */}
            <section className="relative overflow-hidden rounded-2xl border border-[#e3e1dc] bg-white px-5 py-5 shadow-sm">
              <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-[#6366F1] to-[#A5B4FC]" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#b1afa9]">
                Companies
              </p>
              <p className="mt-2 text-3xl font-bold text-[#424143]">
                {platform?.totalCompanies ?? "\u2014"}
              </p>
              <p className="text-[11px] text-[#9a9892]">
                <span className="font-semibold text-[#6366F1]">
                  {platform?.activeCompanies ?? 0}
                </span>{" "}
                active last 30 days
              </p>
            </section>

            {/* Designers */}
            <section className="relative overflow-hidden rounded-2xl border border-[#e3e1dc] bg-white px-5 py-5 shadow-sm">
              <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-[#F15B2B] to-[#f6a07a]" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#b1afa9]">
                Designers
              </p>
              <p className="mt-2 text-3xl font-bold text-[#424143]">
                {platform?.totalDesigners ?? "\u2014"}
              </p>
              <p className="text-[11px] text-[#9a9892]">registered on platform</p>
            </section>

            {/* Tickets */}
            <section className="relative overflow-hidden rounded-2xl border border-[#e3e1dc] bg-white px-5 py-5 shadow-sm">
              <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-[#3B82F6] to-[#93C5FD]" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#b1afa9]">
                Tickets
              </p>
              <p className="mt-2 text-3xl font-bold text-[#424143]">
                {platform?.totalTickets ?? "\u2014"}
              </p>
              <div className="flex gap-3 text-[11px] text-[#9a9892]">
                <span>
                  <span className="font-semibold text-[#22C55E]">
                    +{platform?.ticketsCreatedLast30Days ?? 0}
                  </span>{" "}
                  created
                </span>
                <span>
                  <span className="font-semibold text-[#3B82F6]">
                    {platform?.ticketsCompletedLast30Days ?? 0}
                  </span>{" "}
                  completed
                </span>
              </div>
            </section>

            {/* Tokens */}
            <section className="relative overflow-hidden rounded-2xl border border-[#e3e1dc] bg-white px-5 py-5 shadow-sm">
              <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-[#22C55E] to-[#86EFAC]" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#b1afa9]">
                Token economy
              </p>
              <p className="mt-2 text-3xl font-bold text-[#424143]">
                {tokens?.totalCompanyBalances?.toLocaleString() ?? "\u2014"}
              </p>
              <p className="text-[11px] text-[#9a9892]">total company balances</p>
              {tokens && (
                <div className="mt-2 flex gap-3 text-[11px] text-[#9a9892]">
                  <span>
                    Credits{" "}
                    <span className="font-semibold text-[#22C55E]">
                      {tokens.globalCredits.toLocaleString()}
                    </span>
                  </span>
                  <span>
                    Debits{" "}
                    <span className="font-semibold text-[#EF4444]">
                      {tokens.globalDebits.toLocaleString()}
                    </span>
                  </span>
                </div>
              )}
            </section>
          </div>

          {/* Row 2: Charts */}
          {platform && platform.totalTickets > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {/* Ticket distribution chart */}
              <section className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-5 shadow-sm">
                <h2 className="text-sm font-semibold tracking-tight text-[#424143]">
                  Ticket distribution
                </h2>
                <p className="mt-0.5 text-[11px] text-[#9a9892]">
                  All tickets by workflow status
                </p>
                <div className="mt-4 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={statusChartData}
                      margin={{ top: 4, right: 0, bottom: 0, left: -20 }}
                    >
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: "#9a9892" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: "#9a9892" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid #e3e1dc",
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={56}>
                        {statusChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              {/* Priority distribution chart */}
              <section className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-5 shadow-sm">
                <h2 className="text-sm font-semibold tracking-tight text-[#424143]">
                  Priority distribution
                </h2>
                <p className="mt-0.5 text-[11px] text-[#9a9892]">
                  All tickets by priority level
                </p>
                <div className="mt-4 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={priorityChartData}
                      margin={{ top: 4, right: 0, bottom: 0, left: -20 }}
                    >
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: "#9a9892" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: "#9a9892" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid #e3e1dc",
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={56}>
                        {priorityChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>
          )}

          {/* Row 3: Health indicators + metrics */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Health: Low balance companies */}
            <section className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-5 shadow-sm">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex h-2.5 w-2.5 rounded-full ${
                    (health?.companiesLowBalance ?? 0) > 0
                      ? "bg-[#EF4444]"
                      : "bg-[#22C55E]"
                  }`}
                  aria-label={(health?.companiesLowBalance ?? 0) > 0 ? "Attention needed" : "All clear"}
                  title={(health?.companiesLowBalance ?? 0) > 0 ? "Attention needed" : "All clear"}
                />
                <h2 className="text-sm font-semibold tracking-tight text-[#424143]">
                  Low balance
                </h2>
              </div>
              <p className="mt-2 text-3xl font-bold text-[#424143]">
                {health?.companiesLowBalance ?? 0}
              </p>
              <p className="text-[11px] text-[#9a9892]">
                companies with &lt; 5 tokens
              </p>
            </section>

            {/* Health: Overdue tickets */}
            <section className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-5 shadow-sm">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex h-2.5 w-2.5 rounded-full ${
                    (health?.overdueTickets ?? 0) > 0
                      ? "bg-[#F59E0B]"
                      : "bg-[#22C55E]"
                  }`}
                  aria-label={(health?.overdueTickets ?? 0) > 0 ? "Attention needed" : "All clear"}
                  title={(health?.overdueTickets ?? 0) > 0 ? "Attention needed" : "All clear"}
                />
                <h2 className="text-sm font-semibold tracking-tight text-[#424143]">
                  Overdue tickets
                </h2>
              </div>
              <p className="mt-2 text-3xl font-bold text-[#424143]">
                {health?.overdueTickets ?? 0}
              </p>
              <p className="text-[11px] text-[#9a9892]">
                past due date, not completed
              </p>
            </section>

            {/* Health: Stale tickets */}
            <section className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-5 shadow-sm">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex h-2.5 w-2.5 rounded-full ${
                    (health?.staleTickets ?? 0) > 0
                      ? "bg-[#F59E0B]"
                      : "bg-[#22C55E]"
                  }`}
                  aria-label={(health?.staleTickets ?? 0) > 0 ? "Attention needed" : "All clear"}
                  title={(health?.staleTickets ?? 0) > 0 ? "Attention needed" : "All clear"}
                />
                <h2 className="text-sm font-semibold tracking-tight text-[#424143]">
                  Stale tickets
                </h2>
              </div>
              <p className="mt-2 text-3xl font-bold text-[#424143]">
                {health?.staleTickets ?? 0}
              </p>
              <p className="text-[11px] text-[#9a9892]">
                in progress &gt; 7 days without update
              </p>
            </section>
          </div>

          {/* Row 4: Additional metrics + Quick links */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Avg revisions */}
            <section className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#b1afa9]">
                Avg. revisions
              </p>
              <p className="mt-2 text-2xl font-bold text-[#424143]">
                {platform?.avgRevisionCount ?? "\u2014"}
              </p>
              <p className="text-[11px] text-[#9a9892]">
                per completed ticket
              </p>
            </section>

            {/* Pending withdrawals */}
            <section className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#b1afa9]">
                Pending payouts
              </p>
              <p className="mt-2 text-2xl font-bold text-[#424143]">
                {withdrawals?.pendingCount ?? 0}
              </p>
              <p className="text-[11px] text-[#9a9892]">
                {withdrawals?.pendingAmount?.toLocaleString() ?? 0} tokens total
              </p>
            </section>

            {/* Total paid */}
            <section className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#b1afa9]">
                Total paid out
              </p>
              <p className="mt-2 text-2xl font-bold text-[#424143]">
                {withdrawals?.totalPaid?.toLocaleString() ?? 0}
              </p>
              <p className="text-[11px] text-[#9a9892]">tokens to designers</p>
            </section>

            {/* Net tokens */}
            <section className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#b1afa9]">
                Net token flow
              </p>
              <p className={`mt-2 text-2xl font-bold ${
                (tokens?.globalNet ?? 0) >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"
              }`}>
                {(tokens?.globalNet ?? 0) >= 0 ? "+" : ""}
                {tokens?.globalNet?.toLocaleString() ?? 0}
              </p>
              <p className="text-[11px] text-[#9a9892]">credits minus debits</p>
            </section>
          </div>

          {/* Row 5: Quick links */}
          <div className="grid gap-4 md:grid-cols-3">
            <Link
              href="/admin/withdrawals"
              className="group rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm transition-colors hover:border-[#F15B2B]"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#424143]">
                  Withdrawal queue
                </h3>
                <span className="text-xs text-[#F15B2B] opacity-0 transition-opacity group-hover:opacity-100">
                  Open &rarr;
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#9a9892]">
                {withdrawals?.pendingCount ?? 0} pending request
                {(withdrawals?.pendingCount ?? 0) !== 1 ? "s" : ""}
              </p>
            </Link>

            <Link
              href="/admin/token-analytics"
              className="group rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm transition-colors hover:border-[#F15B2B]"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#424143]">
                  Token analytics
                </h3>
                <span className="text-xs text-[#F15B2B] opacity-0 transition-opacity group-hover:opacity-100">
                  Open &rarr;
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#9a9892]">
                Detailed per-company token breakdowns
              </p>
            </Link>

            <Link
              href="/admin/companies"
              className="group rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm transition-colors hover:border-[#F15B2B]"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#424143]">
                  All companies
                </h3>
                <span className="text-xs text-[#F15B2B] opacity-0 transition-opacity group-hover:opacity-100">
                  Open &rarr;
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#9a9892]">
                {platform?.totalCompanies ?? 0} companies registered
              </p>
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
