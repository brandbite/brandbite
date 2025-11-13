// -----------------------------------------------------------------------------
// @file: app/admin/ledger/page.tsx
// @purpose: Admin ledger view for all token movements (company & designer level)
// @version: v1.0.0
// @lastUpdate: 2025-11-14
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";

type LedgerDirection = "CREDIT" | "DEBIT";

type LedgerEntry = {
  id: string;
  companyId: string | null;
  userId: string | null;
  ticketId: string | null;
  direction: LedgerDirection;
  amount: number;
  reason: string | null;
  notes: string | null;
  metadata: any | null;
  balanceBefore: number | null;
  balanceAfter: number | null;
  createdAt: string;
};

type Pagination = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

type Summary = {
  totalCredit: number;
  totalDebit: number;
  net: number;
};

type Filters = {
  companyId: string | null;
  userId: string | null;
  direction: LedgerDirection | null;
  from: string | null;
  to: string | null;
};

type AdminLedgerResponse = {
  filters: Filters;
  pagination: Pagination;
  summary: Summary;
  ledger: LedgerEntry[];
};

type DirectionOption = "ALL" | "CREDIT" | "DEBIT";

export default function AdminLedgerPage() {
  const [data, setData] = useState<AdminLedgerResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState<number>(1);

  // Filter inputs (user edits these)
  const [companyIdInput, setCompanyIdInput] = useState<string>("");
  const [userIdInput, setUserIdInput] = useState<string>("");
  const [directionInput, setDirectionInput] = useState<DirectionOption>("ALL");
  const [fromInput, setFromInput] = useState<string>("");
  const [toInput, setToInput] = useState<string>("");

  // Active filters (used for fetching)
  const [activeFilters, setActiveFilters] = useState<{
    companyId: string | null;
    userId: string | null;
    direction: DirectionOption;
    from: string | null;
    to: string | null;
  }>({
    companyId: null,
    userId: null,
    direction: "ALL",
    from: null,
    to: null,
  });

  const fetchData = async (pageOverride?: number) => {
    const targetPage = pageOverride ?? page;

    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("page", String(targetPage));
    params.set("pageSize", "50");

    if (activeFilters.companyId) {
      params.set("companyId", activeFilters.companyId);
    }
    if (activeFilters.userId) {
      params.set("userId", activeFilters.userId);
    }
    if (activeFilters.direction === "CREDIT" || activeFilters.direction === "DEBIT") {
      params.set("direction", activeFilters.direction);
    }
    if (activeFilters.from) {
      params.set("from", activeFilters.from);
    }
    if (activeFilters.to) {
      params.set("to", activeFilters.to);
    }

    try {
      const res = await fetch(`/api/admin/ledger?${params.toString()}`);
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body.error || `Request failed with status ${res.status}`);
      }

      const json = body as AdminLedgerResponse;
      setData(json);
      setPage(json.pagination.page);
    } catch (err: any) {
      console.error("Admin ledger fetch error:", err);
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount & whenever filters change
  useEffect(() => {
    fetchData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilters]);

  const handleApplyFilters = () => {
    setActiveFilters({
      companyId: companyIdInput || null,
      userId: userIdInput || null,
      direction: directionInput,
      from: fromInput || null,
      to: toInput || null,
    });
  };

  const handleClearFilters = () => {
    setCompanyIdInput("");
    setUserIdInput("");
    setDirectionInput("ALL");
    setFromInput("");
    setToInput("");
    setActiveFilters({
      companyId: null,
      userId: null,
      direction: "ALL",
      from: null,
      to: null,
    });
  };

  const handlePageChange = (nextPage: number) => {
    if (!data) return;
    if (nextPage < 1 || nextPage > data.pagination.totalPages) return;
    fetchData(nextPage);
  };

  const formatNumber = (value: number) =>
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);

  return (
    <div className="min-h-screen bg-[#f5f3f0] text-[#424143]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Top navigation placeholder */}
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f15b2b] text-sm font-semibold text-white">
              B
            </div>
            <span className="text-lg font-semibold tracking-tight">
              Brandbite
            </span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-[#7a7a7a] md:flex">
            <button className="font-medium text-[#424143]">Dashboard</button>
            <button className="font-medium text-[#424143]">Board</button>
            <button className="font-medium text-[#424143]">Admin</button>
          </nav>
        </header>

        <main className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Admin ledger
              </h1>
              <p className="mt-1 text-sm text-[#7a7a7a]">
                Global view of all token movements across companies and designers.
                Use filters to narrow down by company, user, direction or date.
              </p>
            </div>
          </div>

          {loading && !data && !error && (
            <div className="text-sm text-[#7a7a7a]">Loading ledger…</div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-red-700">
              <p className="font-medium">Error</p>
              <p className="mt-1">{error}</p>
            </div>
          )}

          {data && (
            <>
              {/* Summary + filters */}
              <section className="grid gap-4 md:grid-cols-[minmax(0,2.2fr)_minmax(0,3fr)]">
                {/* Summary cards */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-[#e3e1dc] bg-white px-4 py-3 shadow-sm">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9a9892]">
                      Total credit
                    </h2>
                    <p className="mt-2 text-xl font-semibold text-[#1a7f4b]">
                      +{formatNumber(data.summary.totalCredit)}
                      <span className="ml-1 text-xs font-normal text-[#7a7a7a]">
                        tokens
                      </span>
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#e3e1dc] bg-white px-4 py-3 shadow-sm">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9a9892]">
                      Total debit
                    </h2>
                    <p className="mt-2 text-xl font-semibold text-[#b13832]">
                      -{formatNumber(data.summary.totalDebit)}
                      <span className="ml-1 text-xs font-normal text-[#7a7a7a]">
                        tokens
                      </span>
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#e3e1dc] bg-white px-4 py-3 shadow-sm">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9a9892]">
                      Net
                    </h2>
                    <p
                      className={`mt-2 text-xl font-semibold ${
                        data.summary.net >= 0
                          ? "text-[#1a7f4b]"
                          : "text-[#b13832]"
                      }`}
                    >
                      {data.summary.net >= 0 ? "+" : ""}
                      {formatNumber(data.summary.net)}
                      <span className="ml-1 text-xs font-normal text-[#7a7a7a]">
                        tokens
                      </span>
                    </p>
                  </div>
                </div>

                {/* Filters */}
                <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9a9892]">
                    Filters
                  </h2>
                  <p className="mt-2 text-xs text-[#7a7a7a]">
                    These filters apply to the ledger below and the summary above.
                  </p>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-[#424143]">
                        Company ID
                      </label>
                      <input
                        value={companyIdInput}
                        onChange={(e) => setCompanyIdInput(e.target.value)}
                        placeholder="company id"
                        className="mt-1 w-full rounded-md border border-[#d4d2cc] bg-[#fbfaf8] px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#424143]">
                        User ID (designer)
                      </label>
                      <input
                        value={userIdInput}
                        onChange={(e) => setUserIdInput(e.target.value)}
                        placeholder="designer user id"
                        className="mt-1 w-full rounded-md border border-[#d4d2cc] bg-[#fbfaf8] px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#424143]">
                        Direction
                      </label>
                      <select
                        value={directionInput}
                        onChange={(e) =>
                          setDirectionInput(e.target.value as DirectionOption)
                        }
                        className="mt-1 w-full rounded-md border border-[#d4d2cc] bg-[#fbfaf8] px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
                      >
                        <option value="ALL">All</option>
                        <option value="CREDIT">Credit only</option>
                        <option value="DEBIT">Debit only</option>
                      </select>
                    </div>
                    <div></div>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-[#424143]">
                        From date
                      </label>
                      <input
                        type="date"
                        value={fromInput}
                        onChange={(e) => setFromInput(e.target.value)}
                        className="mt-1 w-full rounded-md border border-[#d4d2cc] bg-[#fbfaf8] px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#424143]">
                        To date
                      </label>
                      <input
                        type="date"
                        value={toInput}
                        onChange={(e) => setToInput(e.target.value)}
                        className="mt-1 w-full rounded-md border border-[#d4d2cc] bg-[#fbfaf8] px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleApplyFilters}
                      className="inline-flex items-center justify-center rounded-full bg-[#f15b2b] px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#e24f21]"
                    >
                      Apply filters
                    </button>
                    <button
                      type="button"
                      onClick={handleClearFilters}
                      className="text-sm font-medium text-[#7a7a7a]"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </section>

              {/* Ledger table + pagination */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9a9892]">
                    Token ledger
                  </h2>
                  <div className="text-xs text-[#7a7a7a]">
                    {data.pagination.totalCount} entries • page{" "}
                    {data.pagination.page} of {data.pagination.totalPages}
                  </div>
                </div>

                {data.ledger.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#e3e1dc] bg-white px-5 py-6 text-sm text-[#7a7a7a]">
                    No ledger entries match the current filters.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-[#e3e1dc] bg-white shadow-sm">
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b border-[#eceae5] bg-[#faf8f5] text-xs uppercase text-[#9a9892]">
                        <tr>
                          <th className="px-4 py-3 font-medium">Date</th>
                          <th className="px-4 py-3 font-medium">Direction</th>
                          <th className="px-4 py-3 font-medium">Amount</th>
                          <th className="px-4 py-3 font-medium">Company</th>
                          <th className="px-4 py-3 font-medium">User</th>
                          <th className="px-4 py-3 font-medium">Reason</th>
                          <th className="px-4 py-3 font-medium">Ticket</th>
                          <th className="px-4 py-3 font-medium">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.ledger.map((entry) => {
                          const date = new Date(entry.createdAt);
                          const isCredit = entry.direction === "CREDIT";
                          const sign = isCredit ? "+" : "-";

                          return (
                            <tr
                              key={entry.id}
                              className="border-t border-[#f1efea] text-xs text-[#424143]"
                            >
                              <td className="px-4 py-3 align-top text-[11px] text-[#7a7a7a]">
                                {date.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 align-top text-[11px]">
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${
                                    isCredit
                                      ? "bg-[#e8f7f0] text-[#1a7f4b]"
                                      : "bg-[#fde8e7] text-[#b13832]"
                                  }`}
                                >
                                  {entry.direction}
                                </span>
                              </td>
                              <td className="px-4 py-3 align-top text-[11px]">
                                <span className="font-mono">
                                  {sign}
                                  {entry.amount}
                                </span>
                              </td>
                              <td className="px-4 py-3 align-top text-[11px] text-[#7a7a7a]">
                                {entry.companyId || "—"}
                              </td>
                              <td className="px-4 py-3 align-top text-[11px] text-[#7a7a7a]">
                                {entry.userId || "—"}
                              </td>
                              <td className="px-4 py-3 align-top text-[11px]">
                                <div className="max-w-[220px]">
                                  <div className="font-mono text-[11px] text-[#424143]">
                                    {entry.reason || "—"}
                                  </div>
                                  {entry.notes && (
                                    <div className="mt-1 text-[11px] text-[#7a7a7a]">
                                      {entry.notes}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 align-top text-[11px] text-[#7a7a7a]">
                                {entry.ticketId || "—"}
                              </td>
                              <td className="px-4 py-3 align-top text-[11px]">
                                {entry.balanceAfter != null ? (
                                  <span className="font-mono">
                                    {entry.balanceAfter}
                                  </span>
                                ) : (
                                  <span className="text-[#b8b6b1]">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {data.pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between pt-2 text-xs text-[#7a7a7a]">
                    <button
                      type="button"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page <= 1}
                      className="inline-flex items-center rounded-full border border-[#e3e1dc] bg-white px-3 py-1.5 text-xs font-medium text-[#424143] disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <div>
                      Page {data.pagination.page} of{" "}
                      {data.pagination.totalPages}
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page >= data.pagination.totalPages}
                      className="inline-flex items-center rounded-full border border-[#e3e1dc] bg-white px-3 py-1.5 text-xs font-medium text-[#424143] disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
