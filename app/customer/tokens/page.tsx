// -----------------------------------------------------------------------------
// @file: app/customer/tokens/page.tsx
// @purpose: Customer-facing token balance & ledger view (session-based)
// @version: v1.3.0
// @status: active
// @lastUpdate: 2025-11-16
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";

type LedgerDirection = "CREDIT" | "DEBIT";

type CompanyRole = "OWNER" | "PM" | "BILLING" | "MEMBER";

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
  const [companyRole, setCompanyRole] = useState<CompanyRole | null>(null);

  const [directionFilter, setDirectionFilter] = useState<
    "ALL" | LedgerDirection
  >("ALL");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/customer/tokens", {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          const msg =
            json?.error || `Request failed with status ${res.status}`;
          throw new Error(msg);
        }

        if (!cancelled) {
          setData(json as CustomerTokensResponse);
        }

        // Fetch company role in the background; failures here should not
        // block the main tokens view.
        try {
          const settingsRes = await fetch("/api/customer/settings", {
            cache: "no-store",
          });
          const settingsJson = await settingsRes.json().catch(() => null);

          if (settingsRes.ok && !cancelled) {
            const role = settingsJson?.user?.companyRole ?? null;
            if (
              role === "OWNER" ||
              role === "PM" ||
              role === "BILLING" ||
              role === "MEMBER" ||
              role === null
            ) {
              setCompanyRole(role);
            }
          }
        } catch (settingsError) {
          console.error(
            "Customer settings fetch error (companyRole only):",
            settingsError,
          );
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

  const filteredLedger = useMemo(
    () =>
      ledger.filter((entry) => {
        if (directionFilter !== "ALL" && entry.direction !== directionFilter) {
          return false;
        }
        return true;
      }),
    [ledger, directionFilter],
  );

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString();
  };

  const formatAmount = (amount: number) =>
    `${amount.toLocaleString("en-US")} tokens`;

  const pillClasses = (direction: LedgerDirection) => {
    const base =
      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium";
    if (direction === "CREDIT") {
      return `${base} bg-[#f0fff6] text-[#137a3a]`;
    }
    return `${base} bg-[#fde8e7] text-[#b13832]`;
  };

  const directionLabel = (direction: LedgerDirection) =>
    direction === "CREDIT" ? "Credit" : "Debit";

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
            <button className="font-medium text-[#424143]">Tokens</button>
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

        {/* Limited access info for non-billing roles */}
        {!error &&
          companyRole &&
          companyRole !== "OWNER" &&
          companyRole !== "BILLING" && (
            <div className="mb-4 rounded-xl border border-[#f6c89f] bg-[#fff4e6] px-4 py-3 text-xs text-[#7a7a7a]">
              <p className="text-[11px] font-medium text-[#9a5b2b]">
                Limited access
              </p>
              <p className="mt-1">
                You can see your company&apos;s token balance and history, but
                only the owner or billing manager can request top-ups or
                billing changes.
              </p>
            </div>
          )}

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
              {loading ? "—" : data ? data.company.tokenBalance : "0"}
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
              Tokens consumed by ticket work and other debits.
            </p>
          </div>
        </section>

        {/* Ledger filters */}
        <section className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">
              Token ledger
            </h2>
            <p className="mt-1 text-xs text-[#9a9892]">
              A chronological view of how tokens have moved in or out of your
              balance.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#7a7a7a]">Filter:</span>
            <div className="inline-flex overflow-hidden rounded-full border border-[#e3e1dc] bg-white">
              <button
                type="button"
                className={`px-3 py-1 text-xs ${
                  directionFilter === "ALL"
                    ? "bg-[#f5f3f0] font-medium text-[#424143]"
                    : "text-[#7a7a7a]"
                }`}
                onClick={() => setDirectionFilter("ALL")}
              >
                All
              </button>
              <button
                type="button"
                className={`border-l border-[#e3e1dc] px-3 py-1 text-xs ${
                  directionFilter === "CREDIT"
                    ? "bg-[#f5f3f0] font-medium text-[#424143]"
                    : "text-[#7a7a7a]"
                }`}
                onClick={() => setDirectionFilter("CREDIT")}
              >
                Credits
              </button>
              <button
                type="button"
                className={`border-l border-[#e3e1dc] px-3 py-1 text-xs ${
                  directionFilter === "DEBIT"
                    ? "bg-[#f5f3f0] font-medium text-[#424143]"
                    : "text-[#7a7a7a]"
                }`}
                onClick={() => setDirectionFilter("DEBIT")}
              >
                Debits
              </button>
            </div>
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
          ) : filteredLedger.length === 0 ? (
            <div className="py-6 text-center text-sm text-[#9a9892]">
              No token movements yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#ebe7df] text-[11px] uppercase tracking-[0.12em] text-[#9a9892]">
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Direction</th>
                    <th className="py-2 pr-4">Amount</th>
                    <th className="py-2 pr-4">Reason</th>
                    <th className="py-2 pr-4">Ticket</th>
                    <th className="py-2 pr-4">Balance before</th>
                    <th className="py-2 pr-4">Balance after</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLedger.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-[#f1eee8] last:border-none"
                    >
                      <td className="py-2 pr-4 align-top text-[11px] text-[#7a7a7a]">
                        {formatDateTime(entry.createdAt)}
                      </td>
                      <td className="py-2 pr-4 align-top">
                        <span className={pillClasses(entry.direction)}>
                          {directionLabel(entry.direction)}
                        </span>
                      </td>
                      <td className="py-2 pr-4 align-top text-[11px] text-[#424143]">
                        {formatAmount(entry.amount)}
                      </td>
                      <td className="py-2 pr-4 align-top text-[11px] text-[#7a7a7a]">
                        {entry.reason || "—"}
                        {entry.notes ? (
                          <span className="ml-1 text-[#9a9892]">
                            ({entry.notes})
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-4 align-top text-[11px] text-[#7a7a7a]">
                        {entry.ticketCode || "—"}
                      </td>
                      <td className="py-2 pr-4 align-top text-[11px] text-[#7a7a7a]">
                        {entry.balanceBefore != null
                          ? entry.balanceBefore
                          : "—"}
                      </td>
                      <td className="py-2 pr-4 align-top text-[11px] text-[#7a7a7a]">
                        {entry.balanceAfter != null
                          ? entry.balanceAfter
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
