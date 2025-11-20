// -----------------------------------------------------------------------------
// @file: app/designer/page.tsx
// @purpose: Designer-facing overview dashboard (tokens + tickets + withdrawals)
// @version: v1.1.0
// @status: active
// @lastUpdate: 2025-11-20
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";

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
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function statusLabel(status: TicketStatus): string {
  switch (status) {
    case "TODO":
      return "Backlog";
    case "IN_PROGRESS":
      return "In progress";
    case "IN_REVIEW":
      return "In review";
    case "DONE":
      return "Done";
  }
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

  // API'den gelen openTotal'ı tercih et, ama geriye dönük güvenlik için fallback bırak
  const openTickets =
    ticketStats?.openTotal != null
      ? ticketStats.openTotal
      : totalTickets > 0
      ? totalTickets - doneTickets
      : 0;

  const loadScore = ticketStats?.loadScore ?? 0;
  const priorityStats = ticketStats?.byPriority ?? null;

  const withdrawalsStats = withdrawalsData?.stats ?? null;
  const latestWithdrawal =
    withdrawalsData && withdrawalsData.withdrawals.length > 0
      ? withdrawalsData.withdrawals[0]
      : null;

  return (
    <div className="min-h-screen bg-[#f5f3f0] text-[#424143]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Top navigation */}
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f15b2b] text-sm font-semibold text-white">
              B
            </div>
            <span className="text-lg font-semibold tracking-tight">
              Brandbite
            </span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-[#7a7a7a] md:flex">
            <button className="font-medium text-[#424143]">
              Overview
            </button>
            <button
              className="font-medium text-[#7a7a7a]"
              onClick={() => (window.location.href = "/designer/tickets")}
            >
              Tickets
            </button>
            <button
              className="font-medium text-[#7a7a7a]"
              onClick={() => (window.location.href = "/designer/balance")}
            >
              Balance
            </button>
            <button
              className="font-medium text-[#7a7a7a]"
              onClick={() => (window.location.href = "/designer/withdrawals")}
            >
              Withdrawals
            </button>
          </nav>
        </header>

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b1afa9]">
              Designer workspace
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Overview
            </h1>
            {user && (
              <p className="mt-1 text-xs text-[#9a9892]">
                Signed in as{" "}
                <span className="font-medium text-[#424143]">
                  {user.name || user.email}
                </span>
                .
              </p>
            )}
          </div>
          {isLoading && (
            <div className="rounded-full bg-[#f5f3f0] px-3 py-1 text-[11px] text-[#7a7a7a]">
              Loading overview…
            </div>
          )}
        </div>

        {/* Error */}
        {isError && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-[#fff7f7] px-4 py-3 text-xs text-red-700">
            <p className="font-medium">Something went wrong</p>
            <p className="mt-1">{state.message}</p>
          </div>
        )}

        {/* Content */}
        {!isError && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Tokens card */}
            <section className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-tight">
                  Tokens
                </h2>
                <button
                  className="text-[11px] font-medium text-[#f15b2b] hover:underline"
                  onClick={() => (window.location.href = "/designer/balance")}
                >
                  View balance
                </button>
              </div>
              <p className="mt-1 text-[11px] text-[#7a7a7a]">
                Your current designer token balance and latest activity.
              </p>

              <div className="mt-3">
                <p className="text-[11px] text-[#9a9892]">
                  Current balance
                </p>
                <p className="text-2xl font-semibold text-[#424143]">
                  {tokenBalance != null ? tokenBalance : "—"}{" "}
                  <span className="text-sm font-normal text-[#9a9892]">
                    tokens
                  </span>
                </p>
                {lastLedgerEntry && (
                  <div className="mt-3 rounded-xl bg-[#f5f3f0] px-3 py-2 text-[11px] text-[#7a7a7a]">
                    <p className="font-medium text-[#424143]">
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
                    {lastLedgerEntry.notes && (
                      <p className="mt-1 text-[11px] text-[#7a7a7a]">
                        {lastLedgerEntry.notes}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* Tickets card */}
            <section className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-tight">
                  Tickets
                </h2>
                <button
                  className="text-[11px] font-medium text-[#f15b2b] hover:underline"
                  onClick={() => (window.location.href = "/designer/tickets")}
                >
                  View tickets
                </button>
              </div>
              <p className="mt-1 text-[11px] text-[#7a7a7a]">
                Snapshot of tickets currently assigned to you and your load.
              </p>

              {ticketStats ? (
                <div className="mt-3 space-y-2 text-[11px] text-[#7a7a7a]">
                  <p>
                    Total tickets:{" "}
                    <span className="font-semibold">{totalTickets}</span>
                  </p>
                  <p>
                    Open tickets (not done):{" "}
                    <span className="font-semibold">{openTickets}</span>
                  </p>
                  <p>
                    Current load score:{" "}
                    <span className="font-semibold">{loadScore}</span>
                  </p>

                  <div className="mt-2 grid grid-cols-2 gap-1">
                    {(Object.entries(ticketStats.byStatus) as [
                      TicketStatus,
                      number,
                    ][]).map(([status, count]) => (
                      <p key={status}>
                        <span className="text-[#9a9892]">
                          {statusLabel(status)}:
                        </span>{" "}
                        <span className="font-semibold">{count}</span>
                      </p>
                    ))}
                  </div>

                  {priorityStats && (
                    <p className="mt-2 text-[11px] text-[#9a9892]">
                      By priority (open):{" "}
                      <span className="font-medium text-[#424143]">
                        Urgent {priorityStats.URGENT ?? 0}
                      </span>
                      {" · "}
                      <span className="font-medium text-[#424143]">
                        High {priorityStats.HIGH ?? 0}
                      </span>
                      {" · "}
                      <span className="font-medium text-[#424143]">
                        Medium {priorityStats.MEDIUM ?? 0}
                      </span>
                      {" · "}
                      <span className="font-medium text-[#424143]">
                        Low {priorityStats.LOW ?? 0}
                      </span>
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-[11px] text-[#9a9892]">
                  We could not load ticket stats yet.
                </p>
              )}
            </section>

            {/* Withdrawals card */}
            <section className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm lg:col-span-1 md:col-span-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-tight">
                  Withdrawals
                </h2>
                <button
                  className="text-[11px] font-medium text-[#f15b2b] hover:underline"
                  onClick={() =>
                    (window.location.href = "/designer/withdrawals")
                  }
                >
                  Request payout
                </button>
              </div>
              <p className="mt-1 text-[11px] text-[#7a7a7a]">
                Quick view of your payout requests and available balance.
              </p>

              {withdrawalsStats ? (
                <div className="mt-3 space-y-2 text-[11px] text-[#7a7a7a]">
                  <p>
                    Available for withdrawal:{" "}
                    <span className="font-semibold">
                      {withdrawalsStats.availableBalance} tokens
                    </span>
                  </p>
                  <p>
                    Total requested so far:{" "}
                    <span className="font-semibold">
                      {withdrawalsStats.totalRequested} tokens
                    </span>
                  </p>
                  <p>
                    Pending requests:{" "}
                    <span className="font-semibold">
                      {withdrawalsStats.pendingCount}
                    </span>
                  </p>
                  <p>
                    Total withdrawals:{" "}
                    <span className="font-semibold">
                      {withdrawalsStats.withdrawalsCount}
                    </span>
                  </p>

                  {latestWithdrawal && (
                    <div className="mt-3 rounded-xl bg-[#f5f3f0] px-3 py-2">
                      <p className="text-[11px] font-medium text-[#424143]">
                        Latest request
                      </p>
                      <p className="mt-1 text-[11px] text-[#7a7a7a]">
                        {latestWithdrawal.amountTokens} tokens —{" "}
                        {withdrawalStatusLabel(latestWithdrawal.status)}
                      </p>
                      <p className="mt-1 text-[11px] text-[#9a9892]">
                        Created {formatDate(latestWithdrawal.createdAt)}
                        {latestWithdrawal.approvedAt
                          ? ` • Updated ${formatDate(
                              latestWithdrawal.approvedAt,
                            )}`
                          : ""}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-[11px] text-[#9a9892]">
                  We could not load withdrawal stats yet.
                </p>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
