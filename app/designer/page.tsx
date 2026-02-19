// -----------------------------------------------------------------------------
// @file: app/designer/page.tsx
// @purpose: Designer-facing overview dashboard (tokens + tickets + withdrawals)
// @version: v2.0.0
// @status: active
// @lastUpdate: 2025-11-25
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  isDueDateOverdue,
  isDueDateSoon,
  formatDueDateCountdown,
} from "@/lib/board";
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

type LedgerDirection = "CREDIT" | "DEBIT";
type WithdrawalStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAID";

type DesignerBalanceResponse = {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  };
  balance: number;
  ledger: {
    id: string;
    createdAt: string;
    direction: LedgerDirection;
    amount: number;
    reason: string | null;
    notes: string | null;
    metadata: unknown;
    balanceBefore: number | null;
    balanceAfter: number | null;
    ticketId: string | null;
    companyId: string | null;
  }[];
};

type DesignerTicket = {
  id: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  dueDate: string | null;
  companyTicketNumber: number | null;
  createdAt: string;
  updatedAt: string;
  company: {
    id: string;
    name: string;
    slug: string;
  } | null;
  project: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  jobType: {
    id: string;
    name: string;
    tokenCost: number;
    designerPayoutTokens: number;
  } | null;
};

type DesignerTicketsResponse = {
  stats: {
    byStatus: Record<TicketStatus, number>;
    total: number;
    openTotal: number;
    byPriority: Record<TicketPriority, number>;
    loadScore: number;
  };
  tickets: DesignerTicket[];
};

type DesignerWithdrawal = {
  id: string;
  amountTokens: number;
  status: WithdrawalStatus;
  createdAt: string;
  approvedAt: string | null;
};

type DesignerWithdrawalsResponse = {
  stats: {
    availableBalance: number;
    totalRequested: number;
    pendingCount: number;
    withdrawalsCount: number;
  };
  withdrawals: DesignerWithdrawal[];
};

type DesignerDashboardData = {
  balance: DesignerBalanceResponse;
  tickets: DesignerTicketsResponse;
  withdrawals: DesignerWithdrawalsResponse;
};

type DashboardState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: DesignerDashboardData };

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "\u2014";
  return d.toLocaleDateString();
}

function withdrawalStatusLabel(status: WithdrawalStatus): string {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "PAID":
      return "Paid";
  }
}

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

export default function DesignerDashboardPage() {
  const [state, setState] = useState<DashboardState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setState({ status: "loading" });

      try {
        const [balanceRes, ticketsRes, withdrawalsRes] = await Promise.all([
          fetch("/api/designer/balance"),
          fetch("/api/designer/tickets"),
          fetch("/api/designer/withdrawals"),
        ]);

        const [balanceJson, ticketsJson, withdrawalsJson] = await Promise.all([
          balanceRes.json().catch(() => null),
          ticketsRes.json().catch(() => null),
          withdrawalsRes.json().catch(() => null),
        ]);

        if (!balanceRes.ok) {
          const message =
            (balanceJson as any)?.error ||
            `Balance request failed with status ${balanceRes.status}`;
          throw new Error(message);
        }

        if (!ticketsRes.ok) {
          const message =
            (ticketsJson as any)?.error ||
            `Tickets request failed with status ${ticketsRes.status}`;
          throw new Error(message);
        }

        if (!withdrawalsRes.ok) {
          const message =
            (withdrawalsJson as any)?.error ||
            `Withdrawals request failed with status ${withdrawalsRes.status}`;
          throw new Error(message);
        }

        if (cancelled) return;

        setState({
          status: "ready",
          data: {
            balance: balanceJson as DesignerBalanceResponse,
            tickets: ticketsJson as DesignerTicketsResponse,
            withdrawals: withdrawalsJson as DesignerWithdrawalsResponse,
          },
        });
      } catch (err: any) {
        console.error("[DesignerDashboard] load error", err);
        if (!cancelled) {
          setState({
            status: "error",
            message:
              err?.message ||
              "Failed to load designer overview. Please try again.",
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

  const balanceData = data?.balance ?? null;
  const ticketsData = data?.tickets ?? null;
  const withdrawalsData = data?.withdrawals ?? null;

  const user = balanceData?.user ?? null;

  const tokenBalance = balanceData?.balance ?? null;
  const lastLedgerEntry =
    balanceData && balanceData.ledger.length > 0
      ? balanceData.ledger[0]
      : null;

  const ticketStats = ticketsData?.stats ?? null;
  const totalTickets = ticketStats?.total ?? 0;
  const doneTickets = ticketStats?.byStatus.DONE ?? 0;

  const openTickets =
    ticketStats?.openTotal != null
      ? ticketStats.openTotal
      : totalTickets > 0
      ? totalTickets - doneTickets
      : 0;

  const loadScore = ticketStats?.loadScore ?? 0;
  const priorityStats = ticketStats?.byPriority ?? null;

  const designerTickets = ticketsData?.tickets ?? [];
  const upcomingTickets = useMemo(
    () =>
      designerTickets
        .filter((t) => t.dueDate != null && t.status !== "DONE")
        .sort(
          (a, b) =>
            new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime(),
        )
        .slice(0, 5),
    [designerTickets],
  );

  const withdrawalsStats = withdrawalsData?.stats ?? null;
  const latestWithdrawal =
    withdrawalsData && withdrawalsData.withdrawals.length > 0
      ? withdrawalsData.withdrawals[0]
      : null;

  /* Chart data for ticket pipeline (stacked bar) */
  const statusChartData = ticketStats
    ? STATUS_ORDER.map((s) => ({
        name: STATUS_LABELS[s],
        count: ticketStats.byStatus[s] ?? 0,
        fill: STATUS_COLORS[s],
      }))
    : [];

  /* Priority chart data */
  const priorityChartData = priorityStats
    ? PRIORITY_ORDER.map((p) => ({
        name: PRIORITY_LABELS[p],
        count: priorityStats[p] ?? 0,
        fill: PRIORITY_COLORS[p],
      }))
    : [];

  /* Load score color */
  const loadScoreColor =
    loadScore >= 80 ? "#EF4444" : loadScore >= 50 ? "#F59E0B" : "#22C55E";

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--bb-text-muted)]">
            Designer workspace
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Overview
          </h1>
          {user && (
            <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
              Signed in as{" "}
              <span className="font-medium text-[var(--bb-secondary)]">
                {user.name || user.email}
              </span>
              .
            </p>
          )}
        </div>
        {isLoading && (
          <LoadingState display="inline" message="Loading overview..." />
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
          {/* Row 1: Hero stat cards */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Token balance card */}
            <section className="relative overflow-hidden rounded-2xl border border-[var(--bb-border)] bg-white px-5 py-5 shadow-sm">
              <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-[#F15B2B] to-[#f6a07a]" />
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--bb-text-muted)]">
                  Token balance
                </p>
                <Link
                  href="/designer/balance"
                  className="text-[11px] font-medium text-[var(--bb-primary)] hover:underline"
                >
                  View balance
                </Link>
              </div>
              <p className="mt-2 text-3xl font-bold text-[var(--bb-secondary)]">
                {tokenBalance != null ? tokenBalance.toLocaleString() : "\u2014"}
              </p>
              <p className="text-[11px] text-[var(--bb-text-tertiary)]">tokens earned</p>

              {/* Last activity */}
              {lastLedgerEntry && (
                <div className="mt-4 rounded-xl bg-[var(--bb-bg-card)] px-3 py-2.5 text-[11px] text-[var(--bb-text-secondary)]">
                  <p className="font-medium text-[var(--bb-secondary)]">
                    Last activity
                  </p>
                  <p className="mt-1">
                    {lastLedgerEntry.direction === "CREDIT"
                      ? "Credited"
                      : "Debited"}{" "}
                    <span className="font-semibold">
                      {lastLedgerEntry.amount} tokens
                    </span>{" "}
                    on {formatDate(lastLedgerEntry.createdAt)}.
                  </p>
                </div>
              )}
            </section>

            {/* Active tickets card */}
            <section className="relative overflow-hidden rounded-2xl border border-[var(--bb-border)] bg-white px-5 py-5 shadow-sm">
              <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-[#3B82F6] to-[#93C5FD]" />
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--bb-text-muted)]">
                  Active tickets
                </p>
                <Link
                  href="/designer/board"
                  className="text-[11px] font-medium text-[var(--bb-primary)] hover:underline"
                >
                  Open board
                </Link>
              </div>
              <p className="mt-2 text-3xl font-bold text-[var(--bb-secondary)]">
                {openTickets}
              </p>
              <p className="text-[11px] text-[var(--bb-text-tertiary)]">
                of {totalTickets} total
              </p>

              {/* Status breakdown dots */}
              {ticketStats && (
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
                  {STATUS_ORDER.filter((s) => s !== "DONE").map((s) => (
                    <div key={s} className="flex items-center gap-1.5 text-[11px]">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: STATUS_COLORS[s] }}
                      />
                      <span className="text-[var(--bb-text-tertiary)]">
                        {STATUS_LABELS[s]}
                      </span>
                      <span className="font-semibold text-[var(--bb-secondary)]">
                        {ticketStats.byStatus[s] ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Earnings / Withdrawals card */}
            <section className="relative overflow-hidden rounded-2xl border border-[var(--bb-border)] bg-white px-5 py-5 shadow-sm">
              <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-[#22C55E] to-[#86EFAC]" />
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--bb-text-muted)]">
                  Earnings
                </p>
                <Link
                  href="/designer/withdrawals"
                  className="text-[11px] font-medium text-[var(--bb-primary)] hover:underline"
                >
                  Request payout
                </Link>
              </div>
              <p className="mt-2 text-3xl font-bold text-[var(--bb-secondary)]">
                {withdrawalsStats?.availableBalance ?? 0}
              </p>
              <p className="text-[11px] text-[var(--bb-text-tertiary)]">
                tokens available for withdrawal
              </p>

              {withdrawalsStats && (
                <div className="mt-4 flex gap-3">
                  <div className="flex-1 rounded-xl bg-[var(--bb-bg-card)] px-3 py-2 text-center">
                    <p className="text-sm font-bold text-[var(--bb-secondary)]">
                      {withdrawalsStats.pendingCount}
                    </p>
                    <p className="text-[10px] text-[var(--bb-text-tertiary)]">
                      Pending
                    </p>
                  </div>
                  <div className="flex-1 rounded-xl bg-[var(--bb-bg-card)] px-3 py-2 text-center">
                    <p className="text-sm font-bold text-[var(--bb-secondary)]">
                      {withdrawalsStats.totalRequested}
                    </p>
                    <p className="text-[10px] text-[var(--bb-text-tertiary)]">
                      Total requested
                    </p>
                  </div>
                  <div className="flex-1 rounded-xl bg-[var(--bb-bg-card)] px-3 py-2 text-center">
                    <p className="text-sm font-bold text-[var(--bb-secondary)]">
                      {withdrawalsStats.withdrawalsCount}
                    </p>
                    <p className="text-[10px] text-[var(--bb-text-tertiary)]">
                      All time
                    </p>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Row 2: Workload charts */}
          {ticketStats && totalTickets > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {/* Status distribution chart */}
              <section className="rounded-2xl border border-[var(--bb-border)] bg-white px-5 py-5 shadow-sm">
                <h2 className="text-sm font-semibold tracking-tight text-[var(--bb-secondary)]">
                  Ticket pipeline
                </h2>
                <p className="mt-0.5 text-[11px] text-[var(--bb-text-tertiary)]">
                  Distribution by workflow stage
                </p>
                <div className="mt-4 h-44">
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
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
                        {statusChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              {/* Priority distribution chart */}
              <section className="rounded-2xl border border-[var(--bb-border)] bg-white px-5 py-5 shadow-sm">
                <h2 className="text-sm font-semibold tracking-tight text-[var(--bb-secondary)]">
                  Priority breakdown
                </h2>
                <p className="mt-0.5 text-[11px] text-[var(--bb-text-tertiary)]">
                  Open tickets by priority level
                </p>
                <div className="mt-4 h-44">
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
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
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

          {/* Row 2.5: Upcoming deadlines */}
          {designerTickets.length > 0 && (
            <section className="rounded-2xl border border-[var(--bb-border)] bg-white px-5 py-5 shadow-sm">
              <h2 className="text-sm font-semibold tracking-tight text-[var(--bb-secondary)]">
                Upcoming deadlines
              </h2>
              <p className="mt-0.5 text-[11px] text-[var(--bb-text-tertiary)]">
                Your assigned tickets with due dates, sorted by urgency
              </p>
              {upcomingTickets.length === 0 ? (
                <p className="mt-4 text-[11px] text-[var(--bb-text-tertiary)]">
                  No upcoming deadlines.
                </p>
              ) : (
                <div className="mt-4 divide-y divide-[var(--bb-border-subtle)]">
                  {upcomingTickets.map((t) => {
                    const countdown = formatDueDateCountdown(t.dueDate);
                    const overdue = isDueDateOverdue(t.dueDate);
                    const soon = isDueDateSoon(t.dueDate);
                    const code =
                      t.project?.code && t.companyTicketNumber != null
                        ? `${t.project.code}-${t.companyTicketNumber}`
                        : t.companyTicketNumber != null
                          ? `#${t.companyTicketNumber}`
                          : "";
                    return (
                      <Link
                        key={t.id}
                        href={`/designer/tickets/${t.id}`}
                        className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 transition-opacity hover:opacity-80"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-[var(--bb-secondary)]">
                            {code && (
                              <span className="mr-1.5 text-[var(--bb-text-tertiary)]">
                                {code}
                              </span>
                            )}
                            {t.title}
                          </p>
                          {t.company && (
                            <p className="mt-0.5 truncate text-[10px] text-[var(--bb-text-tertiary)]">
                              {t.company.name}
                            </p>
                          )}
                        </div>
                        {countdown && (
                          <span
                            className={`ml-4 shrink-0 text-[11px] font-medium ${
                              overdue
                                ? "text-[var(--bb-danger-text)]"
                                : soon
                                  ? "text-[var(--bb-warning-text)]"
                                  : "text-[var(--bb-text-tertiary)]"
                            }`}
                          >
                            {countdown.label}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Row 3: Load score + Latest withdrawal */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Load score card */}
            <section className="rounded-2xl border border-[var(--bb-border)] bg-white px-5 py-5 shadow-sm">
              <h2 className="text-sm font-semibold tracking-tight text-[var(--bb-secondary)]">
                Load score
              </h2>
              <p className="mt-0.5 text-[11px] text-[var(--bb-text-tertiary)]">
                Your current workload capacity indicator.
              </p>

              <div className="mt-4 flex items-center gap-4">
                {/* Circular gauge */}
                <div className="relative flex h-20 w-20 flex-shrink-0 items-center justify-center">
                  <svg
                    className="h-full w-full -rotate-90"
                    viewBox="0 0 36 36"
                  >
                    <circle
                      cx="18"
                      cy="18"
                      r="15.9155"
                      fill="none"
                      stroke="#f5f3f0"
                      strokeWidth="3"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="15.9155"
                      fill="none"
                      stroke={loadScoreColor}
                      strokeWidth="3"
                      strokeDasharray={`${Math.min(loadScore, 100)} ${
                        100 - Math.min(loadScore, 100)
                      }`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute text-lg font-bold text-[var(--bb-secondary)]">
                    {loadScore}
                  </span>
                </div>

                {/* Status breakdown list */}
                {ticketStats && (
                  <div className="flex-1 space-y-1.5">
                    {STATUS_ORDER.map((s) => (
                      <div
                        key={s}
                        className="flex items-center justify-between text-[11px]"
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: STATUS_COLORS[s] }}
                          />
                          <span className="text-[var(--bb-text-tertiary)]">
                            {STATUS_LABELS[s]}
                          </span>
                        </div>
                        <span className="font-semibold text-[var(--bb-secondary)]">
                          {ticketStats.byStatus[s] ?? 0}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Recent withdrawal card */}
            <section className="rounded-2xl border border-[var(--bb-border)] bg-white px-5 py-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-tight text-[var(--bb-secondary)]">
                  Recent withdrawals
                </h2>
                <Link
                  href="/designer/withdrawals"
                  className="text-[11px] font-medium text-[var(--bb-primary)] hover:underline"
                >
                  View all
                </Link>
              </div>
              <p className="mt-0.5 text-[11px] text-[var(--bb-text-tertiary)]">
                Your latest payout requests.
              </p>

              {latestWithdrawal ? (
                <div className="mt-4 space-y-2">
                  {withdrawalsData!.withdrawals.slice(0, 3).map((w) => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between rounded-xl bg-[var(--bb-bg-card)] px-3 py-2.5"
                    >
                      <div>
                        <p className="text-xs font-semibold text-[var(--bb-secondary)]">
                          {w.amountTokens} tokens
                        </p>
                        <p className="text-[10px] text-[var(--bb-text-tertiary)]">
                          {formatDate(w.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          w.status === "PAID"
                            ? "bg-[#e8f6f0] text-[#16a34a]"
                            : w.status === "APPROVED"
                            ? "bg-[#dbeafe] text-[#2563eb]"
                            : w.status === "REJECTED"
                            ? "bg-[#fef2f2] text-[#dc2626]"
                            : "bg-[#fef3c7] text-[#d97706]"
                        }`}
                      >
                        {withdrawalStatusLabel(w.status)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-[11px] text-[var(--bb-text-tertiary)]">
                  No withdrawal requests yet.
                </p>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
