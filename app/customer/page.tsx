// -----------------------------------------------------------------------------
// @file: app/customer/page.tsx
// @purpose: Customer-facing workspace overview dashboard (tokens + tickets + plan)
// @version: v2.0.0
// @status: active
// @lastUpdate: 2025-11-25
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { InlineAlert } from "@/components/ui/inline-alert";
import {
  type CompanyRole,
  normalizeCompanyRole,
  canManagePlan,
  canCreateTickets,
} from "@/lib/permissions/companyRoles";
import {
  isDueDateOverdue,
  isDueDateSoon,
  formatDueDateCountdown,
} from "@/lib/board";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";

type UserRole = "SITE_OWNER" | "SITE_ADMIN" | "DESIGNER" | "CUSTOMER";
type TicketStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
type LedgerDirection = "CREDIT" | "DEBIT";

type CustomerSettingsResponse = {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
    companyRole: CompanyRole | null;
  };
  company: {
    id: string;
    name: string;
    slug: string;
    tokenBalance: number;
    createdAt: string;
    updatedAt: string;
    counts: {
      members: number;
      projects: number;
      tickets: number;
    };
  };
  plan: {
    id: string;
    name: string;
    monthlyTokens: number;
    priceCents: number | null;
    isActive: boolean;
  } | null;
};

type CustomerTokensResponse = {
  company: {
    id: string;
    name: string;
    slug: string;
    tokenBalance: number;
  };
  stats: {
    totalCredits: number;
    totalDebits: number;
  };
  ledger: {
    id: string;
    createdAt: string;
    direction: LedgerDirection;
    amount: number;
    reason: string | null;
    notes: string | null;
    ticketCode: string | null;
    balanceBefore: number | null;
    balanceAfter: number | null;
  }[];
};

type CustomerBoardTicket = {
  id: string;
  title: string;
  status: TicketStatus;
  dueDate: string | null;
  companyTicketNumber: number | null;
  project: { id: string; name: string; code: string | null } | null;
};

type CustomerBoardResponse = {
  stats: {
    byStatus: Record<TicketStatus, number>;
    total: number;
  };
  tickets: CustomerBoardTicket[];
};

type DashboardData = {
  settings: CustomerSettingsResponse;
  tokens: CustomerTokensResponse;
  board: CustomerBoardResponse;
};

type DashboardState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: DashboardData };

function prettyCompanyRole(role: CompanyRole | null): string {
  switch (role) {
    case "OWNER":
      return "Owner";
    case "PM":
      return "Project manager";
    case "BILLING":
      return "Billing manager";
    case "MEMBER":
      return "Member";
    default:
      return "\u2014";
  }
}

function formatMoneyFromCents(cents: number | null | undefined): string {
  if (cents == null) return "\u2014";
  const amount = cents / 100;
  return `$${amount.toFixed(2)}/mo`;
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

export default function CustomerDashboardPage() {
  const [state, setState] = useState<DashboardState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setState({ status: "loading" });

      try {
        const [settingsRes, tokensRes, boardRes] = await Promise.all([
          fetch("/api/customer/settings", { cache: "no-store" }),
          fetch("/api/customer/tokens", { cache: "no-store" }),
          fetch("/api/customer/board", { cache: "no-store" }),
        ]);

        const [settingsJson, tokensJson, boardJson] = await Promise.all([
          settingsRes.json().catch(() => null),
          tokensRes.json().catch(() => null),
          boardRes.json().catch(() => null),
        ]);

        if (!settingsRes.ok) {
          const message =
            (settingsJson as any)?.error ||
            `Settings request failed with status ${settingsRes.status}`;
          throw new Error(message);
        }

        if (!tokensRes.ok) {
          const message =
            (tokensJson as any)?.error ||
            `Tokens request failed with status ${tokensRes.status}`;
          throw new Error(message);
        }

        if (!boardRes.ok) {
          const message =
            (boardJson as any)?.error ||
            `Board request failed with status ${boardRes.status}`;
          throw new Error(message);
        }

        if (cancelled) return;

        setState({
          status: "ready",
          data: {
            settings: settingsJson as CustomerSettingsResponse,
            tokens: tokensJson as CustomerTokensResponse,
            board: boardJson as CustomerBoardResponse,
          },
        });
      } catch (err: any) {
        console.error("[CustomerDashboard] load error", err);
        if (!cancelled) {
          setState({
            status: "error",
            message:
              err?.message ||
              "Failed to load customer overview. Please try again.",
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

  const settings = data?.settings ?? null;
  const tokens = data?.tokens ?? null;
  const board = data?.board ?? null;

  const company = settings?.company ?? null;
  const user = settings?.user ?? null;
  const plan = settings?.plan ?? null;
  const companyRole = normalizeCompanyRole(user?.companyRole ?? null);

  const canManageCompanyPlan = canManagePlan(companyRole);
  const tokenBalance = tokens?.company.tokenBalance ?? null;
  const tokenStats = tokens?.stats ?? null;
  const boardStats = board?.stats ?? null;
  const boardTickets = board?.tickets ?? [];

  const upcomingTickets = useMemo(
    () =>
      boardTickets
        .filter((t) => t.dueDate != null && t.status !== "DONE")
        .sort(
          (a, b) =>
            new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime(),
        )
        .slice(0, 5),
    [boardTickets],
  );

  const openTickets =
    boardStats?.total && boardStats.total > 0
      ? (boardStats.total ?? 0) - (boardStats.byStatus.DONE ?? 0)
      : 0;

  const doneTickets = boardStats?.byStatus.DONE ?? 0;

  /* Chart data for ticket pipeline */
  const pipelineChartData = boardStats
    ? STATUS_ORDER.map((s) => ({
        name: STATUS_LABELS[s],
        count: boardStats.byStatus[s] ?? 0,
        fill: STATUS_COLORS[s],
      }))
    : [];

  /* Token bar data */
  const totalCredits = tokenStats?.totalCredits ?? 0;
  const totalDebits = tokenStats?.totalDebits ?? 0;
  const maxToken = Math.max(totalCredits, totalDebits, 1);

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b1afa9]">
            Customer workspace
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Overview
          </h1>
          {company && (
            <p className="mt-1 text-xs text-[#9a9892]">
              Company{" "}
              <span className="font-medium text-[#424143]">
                {company.name}
              </span>{" "}
              ({company.slug})
            </p>
          )}
          {companyRole && (
            <p className="mt-1 text-xs text-[#9a9892]">
              You are browsing as{" "}
              <span className="font-medium text-[#424143]">
                {prettyCompanyRole(companyRole)}
              </span>
              .
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isLoading && (
            <div className="rounded-full bg-[#f5f3f0] px-3 py-1 text-[11px] text-[#7a7a7a]">
              Loading overview...
            </div>
          )}
          {canCreateTickets(companyRole) && (
            <Link
              href="/customer/tickets/new"
              className="rounded-full bg-[#f15b2b] px-4 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-[#d94e22]"
            >
              + New request
            </Link>
          )}
        </div>
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
            <section className="relative overflow-hidden rounded-2xl border border-[#e3e1dc] bg-white px-5 py-5 shadow-sm">
              <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-[#F15B2B] to-[#f6a07a]" />
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#b1afa9]">
                  Token balance
                </p>
                <Link
                  href="/customer/tokens"
                  className="text-[11px] font-medium text-[#f15b2b] hover:underline"
                >
                  View ledger
                </Link>
              </div>
              <p className="mt-2 text-3xl font-bold text-[#424143]">
                {tokenBalance != null ? tokenBalance.toLocaleString() : "\u2014"}
              </p>
              <p className="text-[11px] text-[#9a9892]">tokens available</p>

              {/* Credit / Debit mini bar */}
              {tokenStats && (
                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="w-14 text-[#9a9892]">Credits</span>
                    <div className="relative h-2 flex-1 rounded-full bg-[#f5f3f0]">
                      <div
                        className="h-full rounded-full bg-[#22C55E]"
                        style={{ width: `${(totalCredits / maxToken) * 100}%` }}
                      />
                    </div>
                    <span className="w-10 text-right font-semibold text-[#424143]">
                      {totalCredits}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="w-14 text-[#9a9892]">Debits</span>
                    <div className="relative h-2 flex-1 rounded-full bg-[#f5f3f0]">
                      <div
                        className="h-full rounded-full bg-[#EF4444]"
                        style={{ width: `${(totalDebits / maxToken) * 100}%` }}
                      />
                    </div>
                    <span className="w-10 text-right font-semibold text-[#424143]">
                      {totalDebits}
                    </span>
                  </div>
                </div>
              )}
            </section>

            {/* Open tickets card */}
            <section className="relative overflow-hidden rounded-2xl border border-[#e3e1dc] bg-white px-5 py-5 shadow-sm">
              <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-[#3B82F6] to-[#93C5FD]" />
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#b1afa9]">
                  Open tickets
                </p>
                <Link
                  href="/customer/board"
                  className="text-[11px] font-medium text-[#f15b2b] hover:underline"
                >
                  Open board
                </Link>
              </div>
              <p className="mt-2 text-3xl font-bold text-[#424143]">
                {openTickets}
              </p>
              <p className="text-[11px] text-[#9a9892]">
                of {boardStats?.total ?? 0} total
              </p>

              {/* Status breakdown dots */}
              {boardStats && (
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
                  {STATUS_ORDER.filter((s) => s !== "DONE").map((s) => (
                    <div key={s} className="flex items-center gap-1.5 text-[11px]">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: STATUS_COLORS[s] }}
                      />
                      <span className="text-[#9a9892]">{STATUS_LABELS[s]}</span>
                      <span className="font-semibold text-[#424143]">
                        {boardStats.byStatus[s] ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Completed tickets card */}
            <section className="relative overflow-hidden rounded-2xl border border-[#e3e1dc] bg-white px-5 py-5 shadow-sm">
              <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-[#22C55E] to-[#86EFAC]" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#b1afa9]">
                Completed
              </p>
              <p className="mt-2 text-3xl font-bold text-[#424143]">
                {doneTickets}
              </p>
              <p className="text-[11px] text-[#9a9892]">
                of {boardStats?.total ?? 0} total
              </p>

              {/* Completion rate */}
              {boardStats && boardStats.total > 0 && (
                doneTickets > 0 ? (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#9a9892]">Completion rate</span>
                      <span className="font-semibold text-[#22C55E]">
                        {Math.round((doneTickets / boardStats.total) * 100)}%
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-[#f5f3f0]">
                      <div
                        className="h-full rounded-full bg-[#22C55E]"
                        style={{
                          width: `${(doneTickets / boardStats.total) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-[11px] text-[#9a9892]">
                    Complete your first ticket to see progress here.
                  </p>
                )
              )}
            </section>
          </div>

          {/* Row 2: Ticket pipeline chart */}
          {boardStats && boardStats.total > 0 && (
            <section className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-5 shadow-sm">
              <h2 className="text-sm font-semibold tracking-tight text-[#424143]">
                Ticket pipeline
              </h2>
              <p className="mt-0.5 text-[11px] text-[#9a9892]">
                Distribution of tickets across workflow stages
              </p>
              <div className="mt-4 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={pipelineChartData}
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
                      {pipelineChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {/* Row 2.5: Upcoming deadlines */}
          {boardTickets.length > 0 && (
            <section className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-5 shadow-sm">
              <h2 className="text-sm font-semibold tracking-tight text-[#424143]">
                Upcoming deadlines
              </h2>
              <p className="mt-0.5 text-[11px] text-[#9a9892]">
                Open tickets with due dates, sorted by urgency
              </p>
              {upcomingTickets.length === 0 ? (
                <p className="mt-4 text-[11px] text-[#9a9892]">
                  No upcoming deadlines.
                </p>
              ) : (
                <div className="mt-4 divide-y divide-[#f0eee9]">
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
                        href={`/customer/tickets/${t.id}`}
                        className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 transition-opacity hover:opacity-80"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-[#424143]">
                            {code && (
                              <span className="mr-1.5 text-[#9a9892]">
                                {code}
                              </span>
                            )}
                            {t.title}
                          </p>
                        </div>
                        {countdown && (
                          <span
                            className={`ml-4 shrink-0 text-[11px] font-medium ${
                              overdue
                                ? "text-[var(--bb-danger-text)]"
                                : soon
                                  ? "text-[var(--bb-warning-text)]"
                                  : "text-[#9a9892]"
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

          {/* Row 3: Company + Plan cards */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Company card */}
            <section className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-5 shadow-sm">
              <h2 className="text-sm font-semibold tracking-tight text-[#424143]">
                Company
              </h2>
              <p className="mt-0.5 text-[11px] text-[#9a9892]">
                Basic workspace metadata and footprint.
              </p>
              {company ? (
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <p className="text-[#9a9892]">Name</p>
                      <p className="font-semibold text-[#424143]">{company.name}</p>
                    </div>
                    <div>
                      <p className="text-[#9a9892]">Slug</p>
                      <p className="font-semibold text-[#424143]">{company.slug}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Members", value: company.counts.members },
                      { label: "Projects", value: company.counts.projects },
                      { label: "Tickets", value: company.counts.tickets },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-xl bg-[#f5f3f0] px-3 py-2.5 text-center"
                      >
                        <p className="text-lg font-bold text-[#424143]">
                          {item.value}
                        </p>
                        <p className="text-[10px] text-[#9a9892]">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-[11px] text-[#9a9892]">
                  We could not load company information.
                </p>
              )}
            </section>

            {/* Plan & billing card */}
            <section className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-tight text-[#424143]">
                  Plan &amp; billing
                </h2>
                <Link
                  href="/customer/settings"
                  className="text-[11px] font-medium text-[#f15b2b] hover:underline"
                >
                  Open settings
                </Link>
              </div>
              <p className="mt-0.5 text-[11px] text-[#9a9892]">
                Your current subscription configuration.
              </p>

              {!canManageCompanyPlan && (
                <div className="mt-3 rounded-lg border border-[#f6c89f] bg-[#fff4e6] px-3 py-2 text-[11px] text-[#7a7a7a]">
                  <p className="font-medium text-[#9a5b2b]">Limited access</p>
                  <p className="mt-1">
                    Only the owner or billing manager can modify billing details.
                  </p>
                </div>
              )}

              {plan ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex rounded-full bg-[#f5f3f0] px-3 py-1 text-xs font-semibold text-[#424143]">
                      {plan.name}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                        plan.isActive
                          ? "bg-[#e8f6f0] text-[#16a34a]"
                          : "bg-[#fef2f2] text-[#dc2626]"
                      }`}
                    >
                      {plan.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[11px]">
                    <div className="rounded-xl bg-[#f5f3f0] px-3 py-2.5 text-center">
                      <p className="text-lg font-bold text-[#424143]">
                        {plan.monthlyTokens}
                      </p>
                      <p className="text-[10px] text-[#9a9892]">Monthly tokens</p>
                    </div>
                    <div className="rounded-xl bg-[#f5f3f0] px-3 py-2.5 text-center">
                      <p className="text-lg font-bold text-[#424143]">
                        {formatMoneyFromCents(plan.priceCents)}
                      </p>
                      <p className="text-[10px] text-[#9a9892]">Price</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-[11px] text-[#9a9892]">
                  No subscription plan is assigned yet. Please contact support.
                </p>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
