// -----------------------------------------------------------------------------
// @file: app/designer/withdrawals/page.tsx
// @purpose: Designer withdrawals dashboard (list + create withdrawal requests)
// @version: v1.1.1
// @lastUpdate: 2025-11-13
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState, FormEvent } from "react";
import { useSearchParams } from "next/navigation";

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
};

type GetResponse = {
  user: DesignerInfo;
  balance: number;
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  withdrawals: Withdrawal[];
};

export default function DesignerWithdrawalsPage() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");

  const [data, setData] = useState<GetResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(!!userId);
  const [error, setError] = useState<string | null>(null);

  const [amountTokens, setAmountTokens] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const fetchData = () => {
    if (!userId) {
      setLoading(false);
      setError(null);
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`/api/designer/withdrawals?userId=${encodeURIComponent(userId)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Request failed with ${res.status}`);
        }
        return res.json();
      })
      .then((json: GetResponse) => {
        setData(json);
      })
      .catch((err: any) => {
        console.error("Designer withdrawals fetch error:", err);
        setError(err.message || "Unknown error");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!userId) return;

    const amount = Number(amountTokens);
    if (!Number.isFinite(amount) || amount <= 0) {
      setSubmitError("Please enter a valid token amount.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(
        `/api/designer/withdrawals?userId=${encodeURIComponent(userId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amountTokens: amount,
            notes: notes || undefined,
          }),
        }
      );

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body.error || `Request failed with ${res.status}`);
      }

      setSubmitSuccess("Withdrawal request created.");
      setAmountTokens("");
      setNotes("");
      fetchData();
    } catch (err: any) {
      console.error("Withdraw create error:", err);
      setSubmitError(err.message || "Unknown error");
    } finally {
      setSubmitting(false);
    }
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
                Designer withdrawals
              </h1>
              <p className="mt-1 text-sm text-[#7a7a7a]">
                Review your withdrawal history and request a new payout. For
                now, the designer is selected with{" "}
                <code className="rounded bg-white px-1 py-0.5 text-xs">
                  ?userId=&lt;id&gt;
                </code>{" "}
                in the URL.
              </p>
            </div>
          </div>

          {!userId && (
            <div className="rounded-xl border border-[#f2d4c7] bg-white px-4 py-3 text-sm text-[#8a3b16]">
              <p className="font-medium">Missing userId parameter</p>
              <p className="mt-1">
                Example:{" "}
                <code className="rounded bg-[#f5f3f0] px-2 py-1 text-xs">
                  /designer/withdrawals?userId=DESIGNER_ID
                </code>
              </p>
            </div>
          )}

          {userId && loading && (
            <div className="text-sm text-[#7a7a7a]">
              Loading withdrawal data…
            </div>
          )}

          {userId && error && !loading && (
            <div className="rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-red-700">
              <p className="font-medium">Error</p>
              <p className="mt-1">{error}</p>
            </div>
          )}

          {userId && data && !loading && !error && (
            <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              {/* Left column: summary + form */}
              <section className="space-y-4">
                <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9a9892]">
                    Designer
                  </h2>
                  <p className="mt-3 text-lg font-semibold">
                    {data.user.name || "Unnamed designer"}
                  </p>
                  <p className="text-sm text-[#7a7a7a]">{data.user.email}</p>
                  <p className="mt-3 inline-flex rounded-full bg-[#f2f1ed] px-3 py-1 text-xs font-medium uppercase tracking-wide text-[#424143]">
                    {data.user.role}
                  </p>

                  <div className="mt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9a9892]">
                      Current balance
                    </h3>
                    <p className="mt-2 text-2xl font-semibold text-[#f15b2b]">
                      {data.balance}
                      <span className="ml-1 text-sm font-normal text-[#7a7a7a]">
                        tokens
                      </span>
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9a9892]">
                    New withdrawal request
                  </h2>

                  <form onSubmit={handleSubmit} className="mt-3 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-[#424143]">
                        Amount (tokens)
                      </label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={amountTokens}
                        onChange={(e) => setAmountTokens(e.target.value)}
                        className="mt-1 w-full rounded-md border border-[#d4d2cc] bg-[#fbfaf8] px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
                        placeholder="e.g. 50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[#424143]">
                        Notes (optional)
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        className="mt-1 w-full rounded-md border border-[#d4d2cc] bg-[#fbfaf8] px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
                        placeholder="Bank details, payout notes, etc."
                      />
                    </div>

                    {submitError && (
                      <p className="text-xs text-red-600">{submitError}</p>
                    )}
                    {submitSuccess && (
                      <p className="text-xs text-[#1a7f4b]">
                        {submitSuccess}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex items-center justify-center rounded-full bg-[#f15b2b] px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#e24f21] disabled:opacity-60"
                    >
                      {submitting ? "Submitting…" : "Create withdrawal request"}
                    </button>
                  </form>
                </div>
              </section>

              {/* Right column: withdrawals list */}
              <section className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9a9892]">
                  Withdrawal history
                </h2>

                {data.withdrawals.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#e3e1dc] bg-white px-5 py-6 text-sm text-[#7a7a7a]">
                    No withdrawal requests yet.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-[#e3e1dc] bg-white shadow-sm">
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b border-[#eceae5] bg-[#faf8f5] text-xs uppercase text-[#9a9892]">
                        <tr>
                          <th className="px-4 py-3 font-medium">
                            Requested at
                          </th>
                          <th className="px-4 py-3 font-medium">Amount</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">Notes</th>
                          <th className="px-4 py-3 font-medium">Approved</th>
                          <th className="px-4 py-3 font-medium">Paid</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.withdrawals.map((w) => {
                          const created = new Date(w.createdAt);
                          const approved = w.approvedAt
                            ? new Date(w.approvedAt)
                            : null;
                          const paid = w.paidAt ? new Date(w.paidAt) : null;

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
                                {created.toLocaleString()}
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
                                <div className="max-w-[220px] text-[11px] text-[#7a7a7a]">
                                  {w.notes || "—"}
                                </div>
                              </td>
                              <td className="px-4 py-3 align-top text-[11px] text-[#7a7a7a]">
                                {approved ? approved.toLocaleString() : "—"}
                              </td>
                              <td className="px-4 py-3 align-top text-[11px] text-[#7a7a7a]">
                                {paid ? paid.toLocaleString() : "—"}
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
          )}
        </main>
      </div>
    </div>
  );
}
