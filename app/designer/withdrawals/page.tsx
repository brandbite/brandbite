// -----------------------------------------------------------------------------
// @file: app/designer/withdrawals/page.tsx
// @purpose: Designer-facing withdrawals overview and request form
// @version: v1.2.1
// @status: active
// @lastUpdate: 2025-11-15
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";

type WithdrawalStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAID";

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

export default function DesignerWithdrawalsPage() {
  const [data, setData] = useState<DesignerWithdrawalsResponse | null>(
    null,
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState<string>("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(
    null,
  );
  const [submitting, setSubmitting] = useState<boolean>(false);

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/designer/withdrawals", {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error(
            "You must be signed in as a designer to view this page.",
          );
        }
        if (res.status === 403) {
          throw new Error(
            "You do not have permission to view designer withdrawals.",
          );
        }
        const msg =
          json?.error || `Request failed with status ${res.status}`;
        throw new Error(msg);
      }

      setData(json as DesignerWithdrawalsResponse);
    } catch (err: any) {
      console.error("Designer withdrawals fetch error:", err);
      setError(err?.message || "Failed to load withdrawals.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const initialLoad = async () => {
      if (cancelled) return;
      await load();
    };

    initialLoad();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const withdrawals = data?.withdrawals ?? [];
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    const parsed = parseInt(amount, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      setSubmitError("Please enter a valid token amount.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/designer/withdrawals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amountTokens: parsed }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          json?.error || `Request failed with status ${res.status}`;
        throw new Error(msg);
      }

      setSubmitSuccess("Withdrawal request created successfully.");
      setAmount("");
      await load();
    } catch (err: any) {
      console.error("Designer withdrawal submit error:", err);
      setSubmitError(
        err?.message || "Failed to create withdrawal request.",
      );
    } finally {
      setSubmitting(false);
    }
  };

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
            <button
              className="font-medium text-[#7a7a7a]"
              onClick={() => (window.location.href = "/designer/balance")}
            >
              Balance
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
              My withdrawals
            </h1>
            <p className="mt-1 text-sm text-[#7a7a7a]">
              Request payouts from your token balance and track their
              status.
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

        {/* Summary + form */}
        <section className="mb-6 grid gap-4 md:grid-cols-[2fr,3fr]">
          {/* Summary cards */}
          <div className="space-y-3">
            <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#9a9892]">
                Available balance
              </p>
              <p className="mt-2 text-3xl font-semibold text-[#f15b2b]">
                {loading
                  ? "—"
                  : stats
                  ? stats.availableBalance
                  : 0}
                <span className="ml-1 text-base font-normal text-[#7a7a7a]">
                  tokens
                </span>
              </p>
              <p className="mt-1 text-xs text-[#9a9892]">
                This is your current token balance before new withdrawals.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#9a9892]">
                  Total requested
                </p>
                <p className="mt-2 text-2xl font-semibold text-[#424143]">
                  {loading
                    ? "—"
                    : stats
                    ? stats.totalRequested
                    : 0}
                </p>
                <p className="mt-1 text-xs text-[#9a9892]">
                  Sum of all your withdrawal requests.
                </p>
              </div>

              <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#9a9892]">
                  Pending requests
                </p>
                <p className="mt-2 text-2xl font-semibold text-[#424143]">
                  {loading
                    ? "—"
                    : stats
                    ? stats.pendingCount
                    : 0}
                </p>
                <p className="mt-1 text-xs text-[#9a9892]">
                  Waiting for approval from admin.
                </p>
              </div>
            </div>
          </div>

          {/* Request form */}
          <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
            <h2 className="text-sm font-semibold tracking-tight">
              Request a withdrawal
            </h2>
            <p className="mt-1 text-xs text-[#7a7a7a]">
              Enter the amount of tokens you would like to withdraw.
              Minimum withdrawal amount applies.
            </p>

            {submitError && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {submitError}
              </div>
            )}

            {submitSuccess && (
              <div className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
                {submitSuccess}
              </div>
            )}

            <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="amount"
                  className="text-xs font-medium text-[#424143]"
                >
                  Amount (tokens)
                </label>
                <input
                  id="amount"
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-md border border-[#d4d2cc] bg-[#fbfaf8] px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
                  placeholder="e.g. 50"
                />
                <p className="text-[11px] text-[#9a9892]">
                  You can only request up to your available balance.
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-full bg-[#f15b2b] px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
              >
                {submitting
                  ? "Submitting…"
                  : "Submit withdrawal request"}
              </button>
            </form>
          </div>
        </section>

        {/* Withdrawals table */}
        <section className="rounded-2xl border border-[#e3e1dc] bg-white px-4 py-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">
              My withdrawal history
            </h2>
            <p className="text-xs text-[#9a9892]">
              Showing {withdrawals.length} requests.
            </p>
          </div>

          {loading ? (
            <div className="py-6 text-center text-sm text-[#7a7a7a]">
              Loading withdrawals…
            </div>
          ) : withdrawals.length === 0 ? (
            <div className="py-6 text-center text-sm text-[#9a9892]">
              You have not requested any withdrawals yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#e3e1dc] text-xs uppercase tracking-[0.08em] text-[#9a9892]">
                    <th className="px-2 py-2">Created</th>
                    <th className="px-2 py-2">Amount</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Approved at</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((w) => (
                    <tr
                      key={w.id}
                      className="border-b border-[#f0eeea] text-xs last:border-b-0"
                    >
                      <td className="px-2 py-2 align-top text-[11px] text-[#7a7a7a]">
                        {formatDateTime(w.createdAt)}
                      </td>
                      <td className="px-2 py-2 align-top text-[11px] text-[#424143]">
                        {w.amountTokens} tokens
                      </td>
                      <td className="px-2 py-2 align-top text-[11px]">
                        {renderStatusBadge(w.status)}
                      </td>
                      <td className="px-2 py-2 align-top text-[11px] text-[#7a7a7a]">
                        {formatDateTime(w.approvedAt)}
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
