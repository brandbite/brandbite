// -----------------------------------------------------------------------------
// @file: app/designer/balance/page.tsx
// @purpose: Designer-facing token balance & ledger view (session-based)
// @version: v1.3.1
// @status: active
// @lastUpdate: 2025-11-15
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";

type LedgerDirection = "CREDIT" | "DEBIT";

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

export default function DesignerBalancePage() {
  const [data, setData] = useState<DesignerBalanceResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/designer/balance");
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          const msg =
            json?.error || `Request failed with status ${res.status}`;
          throw new Error(msg);
        }

        if (!cancelled) {
          setData(json as DesignerBalanceResponse);
        }
      } catch (err: any) {
        console.error("Designer balance fetch error:", err);
        if (!cancelled) {
          setError(err?.message || "Failed to load designer balance.");
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

  const designer = data?.user;
  const ledger = data?.ledger ?? [];

  const totalCredits = useMemo(
    () =>
      ledger
        .filter((l) => l.direction === "CREDIT")
        .reduce((sum, l) => sum + l.amount, 0),
    [ledger],
  );

  const totalDebits = useMemo(
    () =>
      ledger
        .filter((l) => l.direction === "DEBIT")
        .reduce((sum, l) => sum + l.amount, 0),
    [ledger],
  );

  const netBalance = data?.balance ?? totalCredits - totalDebits;

  return (
    <div className="min-h-screen bg-[#f5f3f0] text-[#424143]">
      <div className="mx-auto max-w-5xl px-6 py-10">
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

        {/* Page header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              My token balance
            </h1>
            <p className="mt-1 text-sm text-[#7a7a7a]">
              Tokens you have earned from completed jobs and other adjustments.
            </p>
            {designer && (
              <p className="mt-1 text-xs text-[#9a9892]">
                Signed in as{" "}
                <span className="font-medium text-[#424143]">
                  {designer.name || designer.email}
                </span>
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
              Available balance
            </p>
            <p className="mt-2 text-3xl font-semibold text-[#f15b2b]">
              {loading ? "—" : netBalance}
              <span className="ml-1 text-base font-normal text-[#7a7a7a]">
                tokens
              </span>
            </p>
            <p className="mt-1 text-xs text-[#9a9892]">
              This is your net balance after all credits and debits.
            </p>
          </div>

          <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#9a9892]">
              Total credits
            </p>
            <p className="mt-2 text-2xl font-semibold text-[#424143]">
              {loading ? "—" : totalCredits}
            </p>
            <p className="mt-1 text-xs text-[#9a9892]">
              Tokens you have earned from jobs and adjustments.
            </p>
          </div>

          <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#9a9892]">
              Total debits
            </p>
            <p className="mt-2 text-2xl font-semibold text-[#424143]">
              {loading ? "—" : totalDebits}
            </p>
            <p className="mt-1 text-xs text-[#9a9892]">
              Tokens deducted due to corrections or withdrawals.
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
