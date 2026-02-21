// -----------------------------------------------------------------------------
// @file: app/customer/tokens/page.tsx
// @purpose: Customer-facing token balance & ledger view (session-based)
// @version: v1.4.0
// @status: active
// @lastUpdate: 2025-11-22
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingState } from "@/components/ui/loading-state";

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
      return `${base} bg-[var(--bb-success-bg)] text-[var(--bb-success-text)]`;
    }
    return `${base} bg-[var(--bb-danger-bg)] text-[var(--bb-danger-text)]`;
  };

  const directionLabel = (direction: LedgerDirection) =>
    direction === "CREDIT" ? "Credit" : "Debit";

  return (
    <>
      {/* Page header */}
      <div className="mb-4 mt-2 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Tokens overview
            </h1>
            <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
              Your company&apos;s token balance and recent usage across creative
              requests.
            </p>
            {company && (
              <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
                Company:{" "}
                <span className="font-medium text-[var(--bb-secondary)]">
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
            <div className="mb-4 rounded-xl border border-[var(--bb-warning-border)] bg-[var(--bb-warning-bg)] px-4 py-3 text-xs text-[var(--bb-text-secondary)]">
              <p className="text-[11px] font-medium text-[var(--bb-warning-text)]">
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
          <InlineAlert variant="error" title="Error" className="mb-4">
            {error}
          </InlineAlert>
        )}

        {/* Summary cards */}
        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--bb-text-tertiary)]">
              Current balance
            </p>
            <p className="mt-2 text-3xl font-semibold text-[var(--bb-primary)]">
              {loading ? "—" : data ? data.company.tokenBalance : "0"}
              <span className="ml-1 text-base font-normal text-[var(--bb-text-secondary)]">
                tokens
              </span>
            </p>
            <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
              This is the balance after all debits and credits.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--bb-text-tertiary)]">
              Total credits
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--bb-secondary)]">
              {loading ? "—" : data ? data.stats.totalCredits : "0"}
            </p>
            <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
              Tokens added by plan renewals, manual top-ups or adjustments.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--bb-text-tertiary)]">
              Total debits
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--bb-secondary)]">
              {loading ? "—" : data ? data.stats.totalDebits : "0"}
            </p>
            <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
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
            <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
              A chronological view of how tokens have moved in or out of your
              balance.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[var(--bb-text-secondary)]">Filter:</span>
            <div className="inline-flex overflow-hidden rounded-full border border-[var(--bb-border)] bg-[var(--bb-bg-page)]">
              <button
                type="button"
                className={`px-3 py-1 text-xs ${
                  directionFilter === "ALL"
                    ? "bg-[var(--bb-bg-card)] font-medium text-[var(--bb-secondary)]"
                    : "text-[var(--bb-text-secondary)]"
                }`}
                onClick={() => setDirectionFilter("ALL")}
              >
                All
              </button>
              <button
                type="button"
                className={`border-l border-[var(--bb-border)] px-3 py-1 text-xs ${
                  directionFilter === "CREDIT"
                    ? "bg-[var(--bb-bg-card)] font-medium text-[var(--bb-secondary)]"
                    : "text-[var(--bb-text-secondary)]"
                }`}
                onClick={() => setDirectionFilter("CREDIT")}
              >
                Credits
              </button>
              <button
                type="button"
                className={`border-l border-[var(--bb-border)] px-3 py-1 text-xs ${
                  directionFilter === "DEBIT"
                    ? "bg-[var(--bb-bg-card)] font-medium text-[var(--bb-secondary)]"
                    : "text-[var(--bb-text-secondary)]"
                }`}
                onClick={() => setDirectionFilter("DEBIT")}
              >
                Debits
              </button>
            </div>
          </div>
        </section>

        {/* Ledger table */}
        <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">
              Recent token activity
            </h2>
            <p className="text-xs text-[var(--bb-text-tertiary)]">
              Showing the 50 most recent movements.
            </p>
          </div>

          {loading ? (
            <LoadingState message="Loading token ledger…" />
          ) : filteredLedger.length === 0 ? (
            <EmptyState title="No token movements yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--bb-border-subtle)] text-[11px] uppercase tracking-[0.12em] text-[var(--bb-text-tertiary)]">
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
                      className="border-b border-[var(--bb-border-subtle)] last:border-none"
                    >
                      <td className="py-2 pr-4 align-top text-[11px] text-[var(--bb-text-secondary)]">
                        {formatDateTime(entry.createdAt)}
                      </td>
                      <td className="py-2 pr-4 align-top">
                        <span className={pillClasses(entry.direction)}>
                          {directionLabel(entry.direction)}
                        </span>
                      </td>
                      <td className="py-2 pr-4 align-top text-[11px] text-[var(--bb-secondary)]">
                        {formatAmount(entry.amount)}
                      </td>
                      <td className="py-2 pr-4 align-top text-[11px] text-[var(--bb-text-secondary)]">
                        {entry.reason || "—"}
                        {entry.notes ? (
                          <span className="ml-1 text-[var(--bb-text-tertiary)]">
                            ({entry.notes})
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-4 align-top text-[11px] text-[var(--bb-text-secondary)]">
                        {entry.ticketCode || "—"}
                      </td>
                      <td className="py-2 pr-4 align-top text-[11px] text-[var(--bb-text-secondary)]">
                        {entry.balanceBefore != null
                          ? entry.balanceBefore
                          : "—"}
                      </td>
                      <td className="py-2 pr-4 align-top text-[11px] text-[var(--bb-text-secondary)]">
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
    </>
  );
}
