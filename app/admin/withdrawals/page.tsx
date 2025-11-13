// -----------------------------------------------------------------------------
// @file: app/admin/withdrawals/page.tsx
// @purpose: Admin view & actions for designer withdrawal requests
// @version: v1.0.0
// @lastUpdate: 2025-11-14
// -----------------------------------------------------------------------------

"use client";

import { FormEvent, useEffect, useState } from "react";

type WithdrawalStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAID";

type DesignerInfo = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

type Withdrawal = {
  id: string;
  designerId: string;
  amountTokens: number;
  status: WithdrawalStatus;
  notes: string | null;
  metadata: any | null;
  createdAt: string;
  approvedAt: string | null;
  paidAt: string | null;
  designer: DesignerInfo;
};

type Pagination = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

type AdminWithdrawalsResponse = {
  filters: {
    status: WithdrawalStatus | null;
    designerId: string | null;
    from: string | null;
    to: string | null;
  };
  pagination: Pagination;
  withdrawals: Withdrawal[];
};

type StatusFilterOption = "ALL" | WithdrawalStatus;

export default function AdminWithdrawalsPage() {
  const [data, setData] = useState<AdminWithdrawalsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState<number>(1);

  // Filters - inputs
  const [statusInput, setStatusInput] = useState<StatusFilterOption>("PENDING");
  const [designerIdInput, setDesignerIdInput] = useState<string>("");
  const [fromInput, setFromInput] = useState<string>("");
  const [toInput, setToInput] = useState<string>("");

  // Filters - active
  const [activeFilters, setActiveFilters] = useState<{
    status: StatusFilterOption;
    designerId: string | null;
    from: string | null;
    to: string | null;
  }>({
    status: "PENDING",
    designerId: null,
    from: null,
    to: null,
  });

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchData = async (pageOverride?: number) => {
    const targetPage = pageOverride ?? page;

    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("page", String(targetPage));
    params.set("pageSize", "50");

    if (
      activeFilters.status !== "ALL" &&
      activeFilters.status !== undefined &&
      activeFilters.status !== null
    ) {
      params.set("status", activeFilters.status);
    }
    if (activeFilters.designerId) {
      params.set("designerId", activeFilters.designerId);
    }
    if (activeFilters.from) {
      params.set("from", activeFilters.from);
    }
    if (activeFilters.to) {
      params.set("to", activeFilters.to);
    }

    try {
      const res = await fetch(`/api/admin/withdrawals?${params.toString()}`);
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body.error || `Request failed with status ${res.status}`);
      }

      const json = body as AdminWithdrawalsResponse;
      setData(json);
      setPage(json.pagination.page);
    } catch (err: any) {
      console.error("Admin withdrawals fetch error:", err);
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilters]);

  const handleApplyFilters = () => {
    setActiveFilters({
      status: statusInput,
      designerId: designerIdInput || null,
      from: fromInput || null,
      to: toInput || null,
    });
  };

  const handleClearFilters = () => {
    setStatusInput("PENDING");
    setDesignerIdInput("");
    setFromInput("");
    setToInput("");
    setActiveFilters({
      status: "PENDING",
      designerId: null,
      from: null,
      to: null,
    });
  };

  const handlePageChange = (nextPage: number) => {
    if (!data) return;
    if (nextPage < 1 || nextPage > data.pagination.totalPages) return;
    fetchData(nextPage);
  };

  const runAction = async (
    id: string,
    action: "approve" | "reject" | "mark-paid",
    extra?: { reason?: string }
  ) => {
    setActionError(null);
    setActionSuccess(null);
    setActionLoadingId(id);

    try {
      let url = "";
      let options: RequestInit = { method: "POST" };

      if (action === "approve") {
        url = `/api/admin/withdrawals/${id}/approve`;
      } else if (action === "reject") {
        url = `/api/admin/withdrawals/${id}/reject`;
        options = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: extra?.reason || undefined }),
        };
      } else {
        url = `/api/admin/withdrawals/${id}/mark-paid`;
      }

      const res = await fetch(url, options);
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body.error || `Request failed with status ${res.status}`);
      }

      setActionSuccess(
        action === "approve"
          ? "Withdrawal approved."
          : action === "reject"
          ? "Withdrawal rejected."
          : "Withdrawal marked as paid."
      );
      await fetchData(page);
    } catch (err: any) {
      console.error("Admin withdrawal action error:", err);
      setActionError(err.message || "Unknown error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectClick = (id: string) => {
    // basit prompt; ileride modal olabilir
    const reason = window.prompt(
      "Optional: enter a reason for rejecting this withdrawal (will be stored in metadata):"
    );
    runAction(id, "reject", { reason: reason || undefined });
  };

  const countByStatus = (status: WithdrawalStatus) =>
    data?.withdrawals.filter((w) => w.status === status).length ?? 0;

  const formatDate = (value: string | null) =>
    value ? new Date(value).toLocaleString() : "—";

  const onFiltersSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleApplyFilters();
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
            <button className="font-medium text-[#424143]">Admin</button>
          </nav>
        </header>

        <main className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Admin withdrawals
              </h1>
              <p className="mt-1 text-sm text-[#7a7a7a]">
                Review and manage designer withdrawal requests. Approve,
                reject or mark payouts as paid.
              </p>
            </div>
          </div>

          {loading && !data && !error && (
            <div className="text-sm text-[#7a7a7a]">
              Loading withdrawal requests…
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-red-700">
              <p className="font-medium">Error</p>
              <p className="mt-1">{error}</p>
            </div>
          )}

          {actionError && (
            <div className="rounded-xl border border-red-200 bg-white px-4 py-3 text-xs text-red-700">
              <p className="font-medium">Action error</p>
              <p className="mt-1">{actionError}</p>
            </div>
          )}
          {actionSuccess && (
            <div className="rounded-xl border border-[#c9ead7] bg-white px-4 py-3 text-xs text-[#1a7f4b]">
              {actionSuccess}
            </div>
          )}

          {data && (
            <>
              {/* Summary + filters */}
              <section className="grid gap-4 md:grid-cols-[minmax(0,2.2fr)_minmax(0,3fr)]">
                {/* Summary cards */}
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl border border-[#e3e1dc] bg-white px-4 py-3 shadow-sm">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9a9892]">
                      Pending
                    </h2>
                    <p className="mt-2 text-xl font-semibold text-[#8a6000]">
                      {countByStatus("PENDING")}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#e3e1dc] bg-white px-4 py-3 shadow-sm">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9a9892]">
                      Approved
                    </h2>
                    <p className="mt-2 text-xl font-semibold text-[#245c9b]">
                      {countByStatus("APPROVED")}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#e3e1dc] bg-white px-4 py-3 shadow-sm">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9a9892]">
                      Paid
                    </h2>
                    <p className="mt-2 text-xl font-semibold text-[#1a7f4b]">
                      {countByStatus("PAID")}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#e3e1dc] bg-white px-4 py-3 shadow-sm">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9a9892]">
                      Rejected
                    </h2>
                    <p className="mt-2 text-xl font-semibold text-[#b13832]">
                      {countByStatus("REJECTED")}
                    </p>
                  </div>
                </div>

                {/* Filters */}
                <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9a9892]">
                    Filters
                  </h2>
                  <p className="mt-2 text-xs text-[#7a7a7a]">
                    Filter withdrawal requests by status, designer and date
                    range.
                  </p>

                  <form onSubmit={onFiltersSubmit} className="mt-4 space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-[#424143]">
                          Status
                        </label>
                        <select
                          value={statusInput}
                          onChange={(e) =>
                            setStatusInput(e.target.value as StatusFilterOption)
                          }
                          className="mt-1 w-full rounded-md border border-[#d4d2cc] bg-[#fbfaf8] px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
                        >
                          <option value="PENDING">Pending</option>
                          <option value="APPROVED">Approved</option>
                          <option value="PAID">Paid</option>
                          <option value="REJECTED">Rejected</option>
                          <option value="ALL">All</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#424143]">
                          Designer ID
                        </label>
                        <input
                          value={designerIdInput}
                          onChange={(e) =>
                            setDesignerIdInput(e.target.value)
                          }
                          placeholder="designer user id"
                          className="mt-1 w-full rounded-md border border-[#d4d2cc] bg-[#fbfaf8] px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
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

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <button
                        type="submit"
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
                  </form>
                </div>
              </section>

              {/* Withdrawals table + pagination */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9a9892]">
                    Withdrawal requests
                  </h2>
                  <div className="text-xs text-[#7a7a7a]">
                    {data.pagination.totalCount} requests • page{" "}
                    {data.pagination.page} of {data.pagination.totalPages}
                  </div>
                </div>

                {data.withdrawals.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#e3e1dc] bg-white px-5 py-6 text-sm text-[#7a7a7a]">
                    No withdrawal requests for the current filters.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-[#e3e1dc] bg-white shadow-sm">
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b border-[#eceae5] bg-[#faf8f5] text-xs uppercase text-[#9a9892]">
                        <tr>
                          <th className="px-4 py-3 font-medium">Created</th>
                          <th className="px-4 py-3 font-medium">Designer</th>
                          <th className="px-4 py-3 font-medium">Amount</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">Notes</th>
                          <th className="px-4 py-3 font-medium">Approved</th>
                          <th className="px-4 py-3 font-medium">Paid</th>
                          <th className="px-4 py-3 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.withdrawals.map((w) => {
                          const isPending = w.status === "PENDING";
                          const isApproved = w.status === "APPROVED";
                          const statusColor =
                            w.status === "PENDING"
                              ? "bg-[#fff5dd] text-[#8a6000]"
                              : w.status === "APPROVED"
                              ? "bg-[#e1f0ff] text-[#245c9b]"
                              : w.status === "PAID"
                              ? "bg-[#e8f7f0] text-[#1a7f4b]"
                              : "bg-[#fde8e7] text-[#b13832]";

                          return (
                            <tr
                              key={w.id}
                              className="border-t border-[#f1efea] text-xs text-[#424143]"
                            >
                              <td className="px-4 py-3 align-top text-[11px] text-[#7a7a7a]">
                                {formatDate(w.createdAt)}
                              </td>
                              <td className="px-4 py-3 align-top text-[11px]">
                                <div className="max-w-[180px]">
                                  <div className="font-medium">
                                    {w.designer.name || "Unnamed designer"}
                                  </div>
                                  <div className="text-[11px] text-[#7a7a7a]">
                                    {w.designer.email}
                                  </div>
                                  <div className="mt-1 text-[10px] text-[#9a9892]">
                                    ID: {w.designerId}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 align-top text-[11px]">
                                <span className="font-mono">
                                  {w.amountTokens}
                                </span>
                              </td>
                              <td className="px-4 py-3 align-top text-[11px]">
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${statusColor}`}
                                >
                                  {w.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 align-top text-[11px]">
                                <div className="max-w-[200px] text-[11px] text-[#7a7a7a]">
                                  {w.notes || "—"}
                                </div>
                              </td>
                              <td className="px-4 py-3 align-top text-[11px] text-[#7a7a7a]">
                                {formatDate(w.approvedAt)}
                              </td>
                              <td className="px-4 py-3 align-top text-[11px] text-[#7a7a7a]">
                                {formatDate(w.paidAt)}
                              </td>
                              <td className="px-4 py-3 align-top text-[11px]">
                                <div className="flex flex-col gap-1">
                                  {isPending && (
                                    <>
                                      <button
                                        type="button"
                                        disabled={actionLoadingId === w.id}
                                        onClick={() =>
                                          runAction(w.id, "approve")
                                        }
                                        className="rounded-full bg-[#245c9b] px-3 py-1 text-[11px] font-medium text-white hover:bg-[#1f4f84] disabled:opacity-60"
                                      >
                                        {actionLoadingId === w.id &&
                                        actionSuccess === null
                                          ? "Working…"
                                          : "Approve"}
                                      </button>
                                      <button
                                        type="button"
                                        disabled={actionLoadingId === w.id}
                                        onClick={() =>
                                          handleRejectClick(w.id)
                                        }
                                        className="rounded-full bg-[#b13832] px-3 py-1 text-[11px] font-medium text-white hover:bg-[#972d28] disabled:opacity-60"
                                      >
                                        Reject
                                      </button>
                                    </>
                                  )}
                                  {isApproved && (
                                    <button
                                      type="button"
                                      disabled={actionLoadingId === w.id}
                                      onClick={() =>
                                        runAction(w.id, "mark-paid")
                                      }
                                      className="rounded-full bg-[#1a7f4b] px-3 py-1 text-[11px] font-medium text-white hover:bg-[#14633b] disabled:opacity-60"
                                    >
                                      {actionLoadingId === w.id &&
                                      actionSuccess === null
                                        ? "Working…"
                                        : "Mark paid"}
                                    </button>
                                  )}
                                  {!isPending && !isApproved && (
                                    <span className="text-[11px] text-[#9a9892]">
                                      No actions
                                    </span>
                                  )}
                                </div>
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
