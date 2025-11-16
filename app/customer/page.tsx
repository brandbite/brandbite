// -----------------------------------------------------------------------------
// @file: app/customer/page.tsx
// @purpose: Customer-facing workspace overview dashboard (tokens + tickets + plan)
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-16
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";
import {
  type CompanyRole,
  normalizeCompanyRole,
  canManagePlan,
} from "@/lib/permissions/companyRoles";

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

type CustomerBoardResponse = {
  stats: {
    byStatus: Record<TicketStatus, number>;
    total: number;
  };
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
      return "—";
  }
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function formatMoneyFromCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  const amount = cents / 100;
  return `$${amount.toFixed(2)}/mo`;
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

  const openTickets =
    boardStats?.total && boardStats.total > 0
      ? (boardStats.total ?? 0) - (boardStats.byStatus.DONE ?? 0)
      : 0;

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
              onClick={() => (window.location.href = "/customer/tokens")}
            >
              Tokens
            </button>
            <button
              className="font-medium text-[#7a7a7a]"
              onClick={() => (window.location.href = "/customer/tickets")}
            >
              Tickets
            </button>
            <button
              className="font-medium text-[#7a7a7a]"
              onClick={() => (window.location.href = "/customer/board")}
            >
              Board
            </button>
          </nav>
        </header>

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
                  onClick={() => (window.location.href = "/customer/tokens")}
                >
                  View ledger
                </button>
              </div>
              <p className="mt-1 text-[11px] text-[#7a7a7a]">
                Current token balance and total usage.
              </p>
              <div className="mt-3">
                <p className="text-[11px] text-[#9a9892]">Current balance</p>
                <p className="text-2xl font-semibold text-[#424143]">
                  {tokenBalance != null ? tokenBalance : "—"}{" "}
                  <span className="text-sm font-normal text-[#9a9892]">
                    tokens
                  </span>
                </p>
                {tokenStats && (
                  <div className="mt-3 space-y-1 text-[11px] text-[#7a7a7a]">
                    <p>
                      Total credits:{" "}
                      <span className="font-semibold">
                        {tokenStats.totalCredits}
                      </span>
                    </p>
                    <p>
                      Total debits:{" "}
                      <span className="font-semibold">
                        {tokenStats.totalDebits}
                      </span>
                    </p>
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
                  onClick={() => (window.location.href = "/customer/board")}
                >
                  Open board
                </button>
              </div>
              <p className="mt-1 text-[11px] text-[#7a7a7a]">
                Snapshot of the current ticket pipeline.
              </p>

              {boardStats ? (
                <div className="mt-3 space-y-2 text-[11px] text-[#7a7a7a]">
                  <p>
                    Total tickets:{" "}
                    <span className="font-semibold">
                      {boardStats.total}
                    </span>
                  </p>
                  <p>
                    Open tickets (not done):{" "}
                    <span className="font-semibold">{openTickets}</span>
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    {(Object.entries(boardStats.byStatus) as [
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
                </div>
              ) : (
                <p className="mt-3 text-[11px] text-[#9a9892]">
                  We could not load ticket stats yet.
                </p>
              )}
            </section>

            {/* Company card */}
            <section className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
              <h2 className="text-sm font-semibold tracking-tight">
                Company
              </h2>
              <p className="mt-1 text-[11px] text-[#7a7a7a]">
                Basic workspace metadata and footprint.
              </p>
              {company ? (
                <div className="mt-3 space-y-2 text-[11px] text-[#7a7a7a]">
                  <p>
                    Name:{" "}
                    <span className="font-semibold text-[#424143]">
                      {company.name}
                    </span>
                  </p>
                  <p>
                    Slug:{" "}
                    <span className="font-semibold text-[#424143]">
                      {company.slug}
                    </span>
                  </p>
                  <p>
                    Created:{" "}
                    <span className="font-semibold">
                      {formatDate(company.createdAt)}
                    </span>
                  </p>
                  <p>
                    Last updated:{" "}
                    <span className="font-semibold">
                      {formatDate(company.updatedAt)}
                    </span>
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-[#f5f3f0] px-2 py-2 text-center">
                      <p className="text-xs font-semibold text-[#424143]">
                        {company.counts.members}
                      </p>
                      <p className="text-[10px] text-[#7a7a7a]">Members</p>
                    </div>
                    <div className="rounded-xl bg-[#f5f3f0] px-2 py-2 text-center">
                      <p className="text-xs font-semibold text-[#424143]">
                        {company.counts.projects}
                      </p>
                      <p className="text-[10px] text-[#7a7a7a]">Projects</p>
                    </div>
                    <div className="rounded-xl bg-[#f5f3f0] px-2 py-2 text-center">
                      <p className="text-xs font-semibold text-[#424143]">
                        {company.counts.tickets}
                      </p>
                      <p className="text-[10px] text-[#7a7a7a]">Tickets</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-[11px] text-[#9a9892]">
                  We could not load company information.
                </p>
              )}
            </section>

            {/* Plan & billing card */}
            <section className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm lg:col-span-1 md:col-span-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-tight">
                  Plan &amp; billing
                </h2>
                <button
                  className="text-[11px] font-medium text-[#f15b2b] hover:underline"
                  onClick={() => (window.location.href = "/customer/settings")}
                >
                  Open settings
                </button>
              </div>
              <p className="mt-1 text-[11px] text-[#7a7a7a]">
                Your current subscription configuration for this workspace.
              </p>

              {!canManageCompanyPlan && (
                <div className="mt-3 rounded-lg border border-[#f6c89f] bg-[#fff4e6] px-3 py-2 text-[11px] text-[#7a7a7a]">
                  <p className="font-medium text-[#9a5b2b]">Limited access</p>
                  <p className="mt-1">
                    You can see the current plan, but only the owner or billing
                    manager can modify billing details.
                  </p>
                </div>
              )}

              <div className="mt-3 space-y-2 text-[11px] text-[#7a7a7a]">
                {plan ? (
                  <>
                    <p>
                      Current plan:{" "}
                      <span className="font-semibold text-[#424143]">
                        {plan.name}
                      </span>
                    </p>
                    <p>
                      Monthly tokens:{" "}
                      <span className="font-semibold">
                        {plan.monthlyTokens}
                      </span>
                    </p>
                    <p>
                      Price:{" "}
                      <span className="font-semibold">
                        {formatMoneyFromCents(plan.priceCents)}
                      </span>
                    </p>
                    <p>
                      Status:{" "}
                      <span className="font-semibold">
                        {plan.isActive ? "Active" : "Inactive"}
                      </span>
                    </p>
                  </>
                ) : (
                  <p className="text-[11px] text-[#9a9892]">
                    No subscription plan is assigned to your company yet.
                    Please contact support if this does not look correct.
                  </p>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
