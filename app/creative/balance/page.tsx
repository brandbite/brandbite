// -----------------------------------------------------------------------------
// @file: app/creative/balance/page.tsx
// @purpose: Creative-facing token balance & ledger view (session-based)
// @version: v1.3.1
// @status: active
// @lastUpdate: 2025-11-15
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { DataTable, THead, TH, TD } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingState } from "@/components/ui/loading-state";

type LedgerDirection = "CREDIT" | "DEBIT";

type CreativeBalanceResponse = {
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

export default function CreativeBalancePage() {
  const [data, setData] = useState<CreativeBalanceResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/creative/balance");
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          const msg = json?.error || `Request failed with status ${res.status}`;
          throw new Error(msg);
        }

        if (!cancelled) {
          setData(json as CreativeBalanceResponse);
        }
      } catch (err: any) {
        console.error("Creative balance fetch error:", err);
        if (!cancelled) {
          setError(err?.message || "Failed to load creative balance.");
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

  const creative = data?.user;
  const ledger = data?.ledger ?? [];

  const totalCredits = useMemo(
    () => ledger.filter((l) => l.direction === "CREDIT").reduce((sum, l) => sum + l.amount, 0),
    [ledger],
  );

  const totalDebits = useMemo(
    () => ledger.filter((l) => l.direction === "DEBIT").reduce((sum, l) => sum + l.amount, 0),
    [ledger],
  );

  const netBalance = data?.balance ?? totalCredits - totalDebits;

  return (
    <div className="max-w-5xl">
      {/* Page header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My token balance</h1>
          <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
            Tokens you have earned from completed jobs and other adjustments.
          </p>
          {creative && (
            <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
              Signed in as{" "}
              <span className="font-medium text-[var(--bb-secondary)]">
                {creative.name || creative.email}
              </span>
            </p>
          )}
        </div>
        {ledger.length > 0 && (
          <button
            onClick={() => {
              const rows = [
                ["Date", "Direction", "Amount", "Reason", "Balance After"],
                ...ledger.map((e) => [
                  new Date(e.createdAt).toISOString(),
                  e.direction,
                  String(e.amount),
                  e.reason ?? "",
                  e.balanceAfter != null ? String(e.balanceAfter) : "",
                ]),
              ];
              const csv = rows
                .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
                .join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "token-ledger.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="rounded-xl border border-[var(--bb-border)] px-4 py-2 text-xs font-medium text-[var(--bb-text-secondary)] transition-colors hover:bg-[var(--bb-bg-page)] hover:text-[var(--bb-secondary)]"
          >
            Export CSV
          </button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <InlineAlert variant="error" title="Error" className="mb-4">
          {error}
        </InlineAlert>
      )}

      {/* Summary cards */}
      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
          <p className="text-xs font-medium tracking-[0.12em] text-[var(--bb-text-tertiary)] uppercase">
            Available balance
          </p>
          <p className="mt-2 text-3xl font-semibold text-[var(--bb-primary)]">
            {loading ? "—" : netBalance}
            <span className="ml-1 text-base font-normal text-[var(--bb-text-secondary)]">
              tokens
            </span>
          </p>
          <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
            This is your net balance after all credits and debits.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
          <p className="text-xs font-medium tracking-[0.12em] text-[var(--bb-text-tertiary)] uppercase">
            Total credits
          </p>
          <p className="mt-2 text-2xl font-semibold text-[var(--bb-secondary)]">
            {loading ? "—" : totalCredits}
          </p>
          <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
            Tokens you have earned from jobs and adjustments.
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
          <p className="text-xs font-medium tracking-[0.12em] text-[var(--bb-text-tertiary)] uppercase">
            Total debits
          </p>
          <p className="mt-2 text-2xl font-semibold text-[var(--bb-secondary)]">
            {loading ? "—" : totalDebits}
          </p>
          <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
            Tokens deducted due to corrections or withdrawals.
          </p>
        </div>
      </section>

      {/* Ledger table */}
      <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight">Recent token activity</h2>
          <p className="text-xs text-[var(--bb-text-tertiary)]">
            Showing the 50 most recent movements.
          </p>
        </div>

        {loading ? (
          <LoadingState message="Loading token ledger…" />
        ) : ledger.length === 0 ? (
          <EmptyState title="No token movements yet." />
        ) : (
          <DataTable>
            <THead>
              <TH>When</TH>
              <TH>Direction</TH>
              <TH>Amount</TH>
              <TH>Reason</TH>
              <TH>Notes</TH>
              <TH>Balance</TH>
            </THead>
            <tbody>
              {ledger.map((entry) => {
                const created = new Date(entry.createdAt);
                const isCredit = entry.direction === "CREDIT";

                return (
                  <tr
                    key={entry.id}
                    className="border-b border-[var(--bb-border-subtle)] text-xs last:border-b-0"
                  >
                    <TD>
                      {created.toLocaleDateString()}{" "}
                      {created.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TD>
                    <TD>
                      <Badge variant={entry.direction === "CREDIT" ? "success" : "danger"}>
                        {entry.direction === "CREDIT" ? "Credit" : "Debit"}
                      </Badge>
                    </TD>
                    <TD>
                      {isCredit ? "+" : "-"}
                      {entry.amount}
                    </TD>
                    <TD>{entry.reason ?? "—"}</TD>
                    <TD>{entry.notes ?? "—"}</TD>
                    <TD>{entry.balanceAfter != null ? entry.balanceAfter : "—"}</TD>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        )}
      </section>
    </div>
  );
}
