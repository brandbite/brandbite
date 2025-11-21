// -----------------------------------------------------------------------------
// @file: app/admin/withdrawals/page.tsx
// @purpose: Admin-facing overview & controls for designer withdrawals
// @version: v1.2.0
// @status: active
// @lastUpdate: 2025-11-21
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";

type WithdrawalStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAID";

type AdminWithdrawal = {
  id: string;
  amountTokens: number;
  status: WithdrawalStatus;
  createdAt: string;
  approvedAt: string | null;
  paidAt: string | null;
  adminRejectReason?: string | null;
  designer: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  };
};

type AdminWithdrawalsResponse = {
  stats: {
    totalRequested: number;
    totalPaid: number;
    pendingCount: number;
    withdrawalsCount: number;
  };
  withdrawals: AdminWithdrawal[];
};

type AdminWithdrawalAction = "APPROVE" | "REJECT" | "MARK_PAID";

export default function AdminWithdrawalsPage() {
  const [data, setData] = useState<AdminWithdrawalsResponse | null>(
    null,
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<
    "ALL" | WithdrawalStatus
  >("ALL");
  const [designerFilter, setDesignerFilter] = useState<string>("ALL");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/admin/withdrawals", {
          cache: "no-store",
        });

        const json = await res.json().catch(() => null);

        if (!res.ok) {
          if (res.status === 401) {
            throw new Error(
              "You must be signed in as an admin to view this page.",
            );
          }
          if (res.status === 403) {
            throw new Error(
              "You do not have permission to view admin withdrawals.",
            );
          }
          const msg =
            (json as any)?.error ||
            `Request failed with status ${res.status}`;
          throw new Error(msg);
        }

        if (!cancelled) {
          setData(json as AdminWithdrawalsResponse);
        }
      } catch (err: any) {
        console.error("Admin withdrawals fetch error:", err);
        if (!cancelled) {
          setError(
            err?.message || "Failed to load admin withdrawals.",
          );
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

  const withdrawals = data?.withdrawals ?? [];

  const designers = useMemo(() => {
    const list = Array.from(
      new Set(
        withdrawals.map(
          (w) => w.designer.name || w.designer.email,
        ),
      ),
    );
    return list;
  }, [withdrawals]);

  const filteredWithdrawals = useMemo(() => {
    return withdrawals.filter((w) => {
      if (statusFilter !== "ALL" && w.status !== statusFilter) {
        return false;
      }
      const designerLabel = w.designer.name || w.designer.email;
      if (
        designerFilter !== "ALL" &&
        designerLabel !== designerFilter
      ) {
        return false;
      }
      return true;
    });
  }, [withdrawals, statusFilter, designerFilter]);

  const handleAction = async (
    id: string,
    action: AdminWithdrawalAction,
  ) => {
    setActionLoadingId(`${id}:${action}`);
    setError(null);

    try {
      const res = await fetch("/api/admin/withdrawals", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, action }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          (json as any)?.error ||
          `Failed to update withdrawal (status ${res.status})`;
        throw new Error(msg);
      }

      const updated = (json as any)
        .withdrawal as AdminWithdrawal | undefined;

      if (updated) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                withdrawals: prev.withdrawals.map((w) =>
                  w.id === updated.id ? updated : w,
                ),
              }
            : prev,
        );
      }
    } catch (err: any) {
      console.error("Admin withdrawal action error:", err);
      setError(
        err?.message || "Failed to update withdrawal status.",
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  const stats = data?.stats;

  const formatDateTime = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  };

  const renderStatusBadge = (status: WithdrawalStatus) => {
    const base =
      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold";
    switch (status) {
      case "PENDING":
        return (
          <span className={`${base} bg-[#fff7e0] text-[#8a6b1f]`}>
            Pending
          </span>
        );
      case "APPROVED":
        return (
          <span className={`${base} bg-[#f0fff6] text-[#137a3a]`}>
            Approved
          </span>
        );
      case "REJECTED":
        return (
          <span className={`${base} bg-[#fde8e7] text-[#b13832]`}>
            Rejected
          </span>
        );
      case "PAID":
        return (
          <span className={`${base} bg-[#e7f0ff] text-[#214f9c]`}>
            Paid
          </span>
        );
    }
  };

  const isActionLoading = (id: string, action: AdminWithdrawalAction) =>
    actionLoadingId === `${id}:${action}`;

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
              onClick={() => (window.location.href = "/admin/ledger")}
            >
              Ledger
            </button>
            <button className="font-medium text-[#424143]">
              Withdrawals
            </button>
          </nav>
        </header>

        {/* Page header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Designer withdrawals
            </h1>
            <p className="mt-1 text-sm text-[#7a7a7a]">
              Review, approve and mark designer withdrawal requests as
              paid.
            </p>
          </div>
        </div>

        {/* Error */}
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
              Total requested
            </p>
            <p className="mt-2 text-3xl font-semibold text-[#f15b2b]">
              {loading
                ? "—"
                : stats
                ? stats.totalRequested
                : 0}
              <span className="ml-1 text-base font-normal text-[#7a7a7a]">
                tokens
              </span>
            </p>
            <p className="mt-1 text-xs text-[#9a9892]">
              Sum of all withdrawal requests.
            </p>
          </div>

          <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#9a9892]">
              Total paid
            </p>
            <p className="mt-2 text-2xl font-semibold text-[#424143]">
              {loading ? "—" : stats ? stats.totalPaid : 0}
            </p>
            <p className="mt-1 text-xs text-[#9a9892]">
              Tokens that have been paid out to designers.
            </p>
          </div>

          <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#9a9892]">
              Pending requests
            </p>
            <p className="mt-2 text-2xl font-semibold text-[#424143]">
              {loading ? "—" : stats ? stats.pendingCount : 0}
            </p>
            <p className="mt-1 text-xs text-[#9a9892]">
              Waiting for approval from the admin team.
            </p>
          </div>
        </section>

        {/* Filters */}
        <section className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[#424143]">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as "ALL" | WithdrawalStatus,
                )
              }
              className="rounded-md border border-[#d4d2cc] bg-[#fbfaf8] px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
            >
              <option value="ALL">All</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="PAID">Paid</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[#424143]">
              Designer
            </label>
            <select
              value={designerFilter}
              onChange={(e) => setDesignerFilter(e.target.value)}
              className="rounded-md border border-[#d4d2cc] bg-[#fbfaf8] px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
            >
              <option value="ALL">All designers</option>
              {designers.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Table */}
        <section className="rounded-2xl border border-[#e3e1dc] bg-white px-4 py-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">
              Withdrawal requests
            </h2>
            <p className="text-xs text-[#9a9892]">
              Showing {filteredWithdrawals.length} entries.
            </p>
          </div>

          {loading ? (
            <div className="py-6 text-center text-sm text-[#7a7a7a]">
              Loading withdrawals…
            </div>
          ) : filteredWithdrawals.length === 0 ? (
            <div className="py-6 text-center text-sm text-[#9a9892]">
              No withdrawals match your filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#e3e1dc] text-xs uppercase tracking-[0.08em] text-[#9a9892]">
                    <th className="px-2 py-2">Created</th>
                    <th className="px-2 py-2">Designer</th>
                    <th className="px-2 py-2">Amount</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Approved at</th>
                    <th className="px-2 py-2">Paid at</th>
                    <th className="px-2 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWithdrawals.map((w) => {
                    const designerLabel =
                      w.designer.name || w.designer.email;

                    const canApprove = w.status === "PENDING";
                    const canReject = w.status === "PENDING";
                    const canMarkPaid = w.status === "APPROVED";

                    return (
                      <tr
                        key={w.id}
                        className="border-b border-[#f0eeea] text-xs last:border-b-0"
                      >
                        <td className="px-2 py-2 align-top text-[11px] text-[#7a7a7a]">
                          {formatDateTime(w.createdAt)}
                        </td>
                        <td className="px-2 py-2 align-top text-[11px] text-[#424143]">
                          <div className="font-medium">
                            {designerLabel}
                          </div>
                          <div className="text-[10px] text-[#9a9892]">
                            {w.designer.email}
                          </div>
                        </td>
                        <td className="px-2 py-2 align-top text-[11px] text-[#424143]">
                          {w.amountTokens} tokens
                        </td>
                        <td className="px-2 py-2 align-top text-[11px]">
                          <div className="space-y-1">
                            {renderStatusBadge(w.status)}
                            {w.status === "REJECTED" &&
                              w.adminRejectReason && (
                                <p className="text-[10px] text-[#b13832]">
                                  {w.adminRejectReason}
                                </p>
                              )}
                          </div>
                        </td>
                        <td className="px-2 py-2 align-top text-[11px] text-[#7a7a7a]">
                          {formatDateTime(w.approvedAt)}
                        </td>
                        <td className="px-2 py-2 align-top text-[11px] text-[#7a7a7a]">
                          {formatDateTime(w.paidAt)}
                        </td>
                        <td className="px-2 py-2 align-top text-[11px]">
                          <div className="flex flex-wrap gap-2">
                            <button
                              disabled={
                                !canApprove ||
                                isActionLoading(w.id, "APPROVE")
                              }
                              onClick={() =>
                                handleAction(w.id, "APPROVE")
                              }
                              className="rounded-full border border-[#e3e1dc] bg-[#fbfaf8] px-3 py-1 text-[11px] font-medium text-[#424143] disabled:opacity-50"
                            >
                              {isActionLoading(w.id, "APPROVE")
                                ? "Approving…"
                                : "Approve"}
                            </button>
                            <button
                              disabled={
                                !canReject ||
                                isActionLoading(w.id, "REJECT")
                              }
                              onClick={() =>
                                handleAction(w.id, "REJECT")
                              }
                              className="rounded-full border border-[#fde0de] bg-[#fff7f6] px-3 py-1 text-[11px] font-medium text-[#b13832] disabled:opacity-50"
                            >
                              {isActionLoading(w.id, "REJECT")
                                ? "Rejecting…"
                                : "Reject"}
                            </button>
                            <button
                              disabled={
                                !canMarkPaid ||
                                isActionLoading(w.id, "MARK_PAID")
                              }
                              onClick={() =>
                                handleAction(w.id, "MARK_PAID")
                              }
                              className="rounded-full border border-[#d6e4ff] bg-[#f4f7ff] px-3 py-1 text-[11px] font-medium text-[#214f9c] disabled:opacity-50"
                            >
                              {isActionLoading(w.id, "MARK_PAID")
                                ? "Marking…"
                                : "Mark as paid"}
                            </button>
                          </div>
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
