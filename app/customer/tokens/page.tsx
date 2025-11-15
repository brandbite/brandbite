// -----------------------------------------------------------------------------
// @file: app/customer/tokens/page.tsx
// @purpose: Customer-facing token balance & ledger view (session-based)
// @version: v1.1.0
// @status: active
// @lastUpdate: 2025-11-14
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";

type LedgerDirection = "CREDIT" | "DEBIT";

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

export default function CustomerTokensPage() {
  const [data, setData] = useState<CustomerTokensResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/customer/tokens");
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          const msg =
            json?.error || `Request failed with status ${res.status}`;
          throw new Error(msg);
        }

        if (!cancelled) {
          setData(json as CustomerTokensResponse);
        }
      } catch (err: any) {
        console.error("Customer tokens fetch error:", err);
        if (!cancelled) {
          setError(err?.message || "Failed to load tokens.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const company = data?.company;
  const ledger = data?.ledger ?? [];

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
            <button
              className="font-medium text-[#7a7a7a]"
              onClick={() => (window.location.href = "/customer/tickets")}
            >
              My tickets
            </button>
            <button
              className="font-medium text-[#7a7a7a]"
              onClick={() => (window.location.href = "/customer/tickets/new")}
            >
              New ticket
            </button>
            <button className="font-medium text-[#424143]">Tokens</button>
          </nav>
        </header>

        {/* Page header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Tokens overview
            </h1>
            <p className="mt-1 text-sm text-[#7a7a7a]">
              Your company&apos;s token balance and recent usage across design
              requests.
            </p>
            {company && (
              <p className="mt-1 text-xs text-[#9a9892]">
                Company:{" "}
                <span className="font-medium text-[#424143]">
                  {company.name}
                </span>{" "}
                ({company.slug})
              </p>
            )}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-red-700">
            <p className="font-medium">Error</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {/* Summary cards */}
        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#9a9892]">
              Current balance
            </p>
            <p className="mt-2 text-3xl font-semibold text-[#f15b2b]">
              {loading
                ? "—"
                : data
                ? data.company.tokenBalance
                : "0"}
              <span className="ml-1 text-base font-normal text-[#7a7a7a]">
                tokens
              </span>
            </p>
            <p className="mt-1 text-xs text-[#9a9892]">
              This is the balance after all debits and credits.
            </p>
          </div>

          <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#9a9892]">
              Total credits
            </p>
            <p className="mt-2 text-2xl font-semibold text-[#424143]">
              {loading ? "—" : data ? data.stats.totalCredits : "0"}
            </p>
            <p className="mt-1 text-xs text-[#9a9892]">
              Tokens added by plan renewals, manual top-ups or adjustments.
            </p>
          </div>

          <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#9a9892]">
              Total debits
            </p>
            <p className="mt-2 text-2xl font-semibold text-[#424143]">
              {loading ? "—" : data ? data.stats.totalDebits : "0"}
            </p>
            <p className="mt-1 text-xs text-[#9a9892]">
              Tokens spent on design jobs and requests.
            </p>
          </div>
        </section>

        {/* Ledger table */}
        <section className="rounded-2xl border border-[#e3e1dc] bg-white px-4 py-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">
              Recent token activity
            </h2>
            <p className="text-xs text-[#9a9892]">
              Showing the 50 most recent movements.
            </p>
          </div>

          {loading ? (
            <div className="py-6 text-center text-sm text-[#7a7a7a]">
              Loading token ledger…
            </div>
          ) : ledger.length === 0 ? (
            <div className="py-6 text-center text-sm text-[#9a9892]">
              No token movements yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#e3e1dc] text-xs uppercase tracking-[0.08em] text-[#9a9892]">
                    <th className="px-2 py-2">When</th>
                    <th className="px-2 py-2">Direction</th>
                    <th className="px-2 py-2">Amount</th>
                    <th className="px-2 py-2">Ticket</th>
                    <th className="px-2 py-2">Reason</th>
                    <th className="px-2 py-2">Notes</th>
                    <th className="px-2 py-2">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((entry) => {
                    const created = new Date(entry.createdAt);
                    const isCredit = entry.direction === "CREDIT";

                    return (
                      <tr
                        key={entry.id}
                        className="border-b border-[#f0eeea] text-xs last:border-b-0"
                      >
                        <td className="px-2 py-2 align-top text-[11px] text-[#7a7a7a]">
                          {created.toLocaleDateString()}{" "}
                          {created.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-2 py-2 align-top">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              isCredit
                                ? "bg-[#f0fff6] text-[#137a3a]"
                                : "bg-[#fde8e7] text-[#b13832]"
                            }`}
                          >
                            {isCredit ? "Credit" : "Debit"}
                          </span>
                        </td>
                        <td className="px-2 py-2 align-top text-[11px] text-[#424143]">
                          {isCredit ? "+" : "-"}
                          {entry.amount}
                        </td>
                        <td className="px-2 py-2 align-top text-[11px] text-[#424143]">
                          {entry.ticketCode ?? "—"}
                        </td>
                        <td className="px-2 py-2 align-top text-[11px] text-[#424143]">
                          {entry.reason ?? "—"}
                        </td>
                        <td className="px-2 py-2 align-top text-[11px] text-[#7a7a7a]">
                          {entry.notes ?? "—"}
                        </td>
                        <td className="px-2 py-2 align-top text-[11px] text-[#9a9892]">
                          {entry.balanceAfter != null
                            ? entry.balanceAfter
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
