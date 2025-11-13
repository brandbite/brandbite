// -----------------------------------------------------------------------------
// @file: app/designer/balance/page.tsx
// @purpose: Designer balance dashboard page (tokens + recent ledger entries)
// @version: v1.1.0
// @lastUpdate: 2025-11-13
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type DesignerInfo = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

type LedgerEntry = {
  id: string;
  direction: "CREDIT" | "DEBIT";
  amount: number;
  reason: string | null;
  notes: string | null;
  metadata: any | null;
  balanceBefore: number | null;
  balanceAfter: number | null;
  createdAt: string;
  ticketId: string | null;
  companyId?: string | null;
};

type BalanceResponse = {
  user: DesignerInfo;
  balance: number;
  ledger: LedgerEntry[];
};

export default function DesignerBalancePage() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");

  const [data, setData] = useState<BalanceResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(!!userId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setError(null);
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`/api/designer/balance?userId=${encodeURIComponent(userId)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Request failed with ${res.status}`);
        }
        return res.json();
      })
      .then((json: BalanceResponse) => {
        setData(json);
      })
      .catch((err: any) => {
        console.error("Designer balance fetch error:", err);
        setError(err.message || "Unknown error");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [userId]);

  return (
    <div className="min-h-screen bg-[#f5f3f0] text-[#424143]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Top navigation placeholder (to feel like Brandbite UI) */}
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
                Designer balance
              </h1>
              <p className="mt-1 text-sm text-[#7a7a7a]">
                View your current token balance and the latest token movements.
                For now the designer is selected via{" "}
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
                  /designer/balance?userId=DESIGNER_ID
                </code>
              </p>
            </div>
          )}

          {userId && loading && (
            <div className="text-sm text-[#7a7a7a]">Loading designer data…</div>
          )}

          {userId && error && !loading && (
            <div className="rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-red-700">
              <p className="font-medium">Error</p>
              <p className="mt-1">{error}</p>
            </div>
          )}

          {userId && data && !loading && !error && (
            <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              {/* Left column: designer + balance */}
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
                </div>

                <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9a9892]}>
                    Current balance
                  </h2>
                  <p className="mt-3 text-3xl font-semibold text-[#f15b2b]">
                    {data.balance}
                    <span className="ml-1 text-base font-normal text-[#7a7a7a]">
                      tokens
                    </span>
                  </p>
                  <p className="mt-2 text-sm text-[#7a7a7a]">
                    This value is calculated from all CREDIT and DEBIT entries
                    for this designer.
                  </p>
                </div>
              </section>

              {/* Right column: ledger table */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9a9892]">
                    Recent activity
                  </h2>
                </div>

                {data.ledger.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#e3e1dc] bg-white px-5 py-6 text-sm text-[#7a7a7a]">
                    No token movements yet for this designer.
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
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
