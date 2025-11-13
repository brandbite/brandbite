// -----------------------------------------------------------------------------
// @file: app/customer/tokens/page.tsx
// @purpose: Customer token balance & ledger view (company-level tokens)
// @version: v1.0.0
// @lastUpdate: 2025-11-13
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type CompanyInfo = {
  id: string;
  name: string;
  slug: string;
  tokenBalance: number;
};

type LedgerDirection = "CREDIT" | "DEBIT";

type LedgerEntry = {
  id: string;
  direction: LedgerDirection;
  amount: number;
  reason: string | null;
  notes: string | null;
  metadata: any | null;
  balanceBefore: number | null;
  balanceAfter: number | null;
  createdAt: string;
  ticketId: string | null;
};

type Pagination = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

type CustomerTokensResponse = {
  company: CompanyInfo;
  pagination: Pagination;
  filters: {
    from: string | null;
    to: string | null;
  };
  ledger: LedgerEntry[];
};

export default function CustomerTokensPage() {
  const searchParams = useSearchParams();
  const companyId = searchParams.get("companyId");

  const [data, setData] = useState<CustomerTokensResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(!!companyId);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState<number>(1);

  // Filter inputs (what user types)
  const [fromInput, setFromInput] = useState<string>("");
  const [toInput, setToInput] = useState<string>("");

  // Active filters (actually applied to query)
  const [activeFrom, setActiveFrom] = useState<string | null>(null);
  const [activeTo, setActiveTo] = useState<string | null>(null);

  const fetchData = (pageOverride?: number) => {
    if (!companyId) {
      setLoading(false);
      setError(null);
      setData(null);
      return;
    }

    const targetPage = pageOverride ?? page;

    const params = new URLSearchParams();
    params.set("companyId", companyId);
    params.set("page", String(targetPage));

    if (activeFrom) params.set("from", activeFrom);
    if (activeTo) params.set("to", activeTo);

    setLoading(true);
    setError(null);

    fetch(`/api/customer/tokens?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Request failed with ${res.status}`);
        }
        return res.json();
      })
      .then((json: CustomerTokensResponse) => {
        setData(json);
        setPage(json.pagination.page);
      })
      .catch((err: any) => {
        console.error("Customer tokens fetch error:", err);
        setError(err.message || "Unknown error");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  // When companyId or active filters change, reload from page 1
  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      setError(null);
      setData(null);
      return;
    }
    setPage(1);
    fetchData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, activeFrom, activeTo]);

  const handleApplyFilters = () => {
    setActiveFrom(fromInput || null);
    setActiveTo(toInput || null);
  };

  const handleClearFilters = () => {
    setFromInput("");
    setToInput("");
    setActiveFrom(null);
    setActiveTo(null);
  };

  const handlePageChange = (nextPage: number) => {
    if (!data) return;
    if (nextPage < 1 || nextPage > data.pagination.totalPages) return;
    fetchData(nextPage);
  };

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
            <button className="font-medium text-[#424143]">Plans</button>
          </nav>
        </header>

        <main className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Customer tokens
              </h1>
              <p className="mt-1 text-sm text-[#7a7a7a]">
                View company-level token balance and the full ledger of token
                movements. For now the company is selected via{" "}
                <code className="rounded bg-white px-1 py-0.5 text-xs">
                  ?companyId=&lt;id&gt;
                </code>{" "}
                in the URL.
              </p>
            </div>
          </div>

          {!companyId && (
            <div className="rounded-xl border border-[#f2d4c7] bg-white px-4 py-3 text-sm text-[#8a3b16]">
              <p className="font-medium">Missing companyId parameter</p>
              <p className="mt-1">
                Example:{" "}
                <code className="rounded bg-[#f5f3f0] px-2 py-1 text-xs">
                  /customer/tokens?companyId=COMPANY_ID
                </code>
              </p>
            </div>
          )}

          {companyId && loading && (
            <div className="text-sm text-[#7a7a7a]">
              Loading company tokens…
            </div>
          )}

          {companyId && error && !loading && (
            <div className="rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-red-700">
              <p className="font-medium">Error</p>
              <p className="mt-1">{error}</p>
            </div>
          )}

          {companyId && data && !loading && !error && (
            <div className="space-y-6">
              {/* Summary + filters */}
              <section className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9a9892]">
                      Company
                    </h2>
                    <p className="mt-3 text-lg font-semibold">
                      {data.company.name}
                    </p>
                    <p className="text-sm text-[#7a7a7a]">
                      slug:{" "}
                      <span className="font-mono text-xs">
                        {data.company.slug}
                      </span>
                    </p>
                    <p className="mt-3 inline-flex rounded-full bg-[#f2f1ed] px-3 py-1 text-xs font-medium uppercase tracking-wide text-[#424143]">
                      Company ID: {data.company.id}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9a9892]">
                      Current balance
                    </h2>
                    <p className="mt-3 text-3xl font-semibold text-[#f15b2b]">
                      {data.company.tokenBalance}
                      <span className="ml-1 text-base font-normal text-[#7a7a7a]">
                        tokens
                      </span>
                    </p>
                    <p className="mt-2 text-sm text-[#7a7a7a]">
                      This value is updated whenever token ledger entries are
                      created for this company.
                    </p>
                  </div>
                </div>

                {/* Filters */}
                <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9a9892]">
                    Ledger filters
                  </h2>
                  <p className="mt-2 text-xs text-[#7a7a7a]">
                    Filter ledger entries by date range. These filters apply to
                    the list on the right.
                  </p>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
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

                  <div className="mt-3 text-xs text-[#9a9892]">
                    Active filters:{" "}
                    {activeFrom || activeTo ? (
                      <>
                        {activeFrom && (
                          <span className="mr-2 inline-flex rounded-full bg-[#f2f1ed] px-2 py-0.5">
                            from: {activeFrom}
                          </span>
                        )}
                        {activeTo && (
                          <span className="inline-flex rounded-full bg-[#f2f1ed] px-2 py-0.5">
                            to: {activeTo}
                          </span>
                        )}
                      </>
                    ) : (
                      <span>none</span>
                    )}
                  </div>
                </div>
              </section>

              {/* Ledger + pagination */}
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
                    No token movements found for this filter.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-[#e3e1dc] bg-white shadow-sm">
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b border-[#eceae5] bg-[#faf8f5] text-xs uppercase text-[#9a9892]">
                        <tr>
                          <th className="px-4 py-3 font-medium">Date</th>
                          <th className="px-4 py-3 font-medium">Direction</th>
                          <th className="px-4 py-3 font-medium">Amount</th>
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
                              <td className="px-4 py-3 align-top text-[11px]">
                                <div className="max-w-[260px]">
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

                {/* Pagination controls */}
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
                      Page {data.pagination.page} of {data.pagination.totalPages}
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
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
