// -----------------------------------------------------------------------------
// @file: app/admin/ledger/page.tsx
// @purpose: Admin-facing global token ledger overview
// @version: v1.1.0
// @status: active
// @lastUpdate: 2025-11-15
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import { DataTable, THead, TH, TD } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FormSelect } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { formatRole } from "@/lib/roles";

type LedgerDirection = "CREDIT" | "DEBIT";

type AdminLedgerEntry = {
  id: string;
  createdAt: string;
  direction: LedgerDirection;
  amount: number;
  reason: string | null;
  notes: string | null;
  company: {
    id: string;
    name: string;
    slug: string;
  } | null;
  ticket: {
    id: string;
    title: string;
    code: string | null;
    projectName: string | null;
    projectCode: string | null;
  } | null;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  } | null;
  balanceBefore: number | null;
  balanceAfter: number | null;
  metadata: unknown;
};

type AdminLedgerResponse = {
  stats: {
    totalCredits: number;
    totalDebits: number;
    netTokens: number;
    entriesCount: number;
  };
  entries: AdminLedgerEntry[];
};

export default function AdminLedgerPage() {
  const [data, setData] = useState<AdminLedgerResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [companyFilter, setCompanyFilter] = useState<string>("ALL");
  const [directionFilter, setDirectionFilter] = useState<
    "ALL" | LedgerDirection
  >("ALL");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/admin/ledger", {
          // Admin view, we always want fresh data
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
              "You do not have permission to view the admin ledger.",
            );
          }
          const msg =
            json?.error || `Request failed with status ${res.status}`;
          throw new Error(msg);
        }

        if (!cancelled) {
          setData(json as AdminLedgerResponse);
        }
      } catch (err: any) {
        console.error("Admin ledger fetch error:", err);
        if (!cancelled) {
          setError(err?.message || "Failed to load admin ledger.");
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

  const entries = data?.entries ?? [];

  const companies = useMemo(() => {
    const list = Array.from(
      new Set(
        entries
          .map((e) => e.company?.name)
          .filter((name): name is string => !!name),
      ),
    );
    return list;
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (companyFilter !== "ALL" && e.company?.name !== companyFilter) {
        return false;
      }
      if (directionFilter !== "ALL" && e.direction !== directionFilter) {
        return false;
      }
      return true;
    });
  }, [entries, companyFilter, directionFilter]);

  return (
    <>
        {/* Page header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Global token ledger
            </h1>
            <p className="mt-1 text-sm text-[#7a7a7a]">
              All token movements across companies, jobs and creatives. Only
              visible to site admins.
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <InlineAlert variant="error" title="Error" className="mb-4">
            {error}
          </InlineAlert>
        )}

        {/* Summary cards */}
        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#9a9892]">
              Net tokens
            </p>
            <p className="mt-2 text-3xl font-semibold text-[#f15b2b]">
              {loading
                ? "—"
                : data
                ? data.stats.netTokens
                : 0}
            </p>
            <p className="mt-1 text-xs text-[#9a9892]">
              Total credits minus total debits in the system.
            </p>
          </div>

          <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#9a9892]">
              Total credits
            </p>
            <p className="mt-2 text-2xl font-semibold text-[#424143]">
              {loading
                ? "—"
                : data
                ? data.stats.totalCredits
                : 0}
            </p>
            <p className="mt-1 text-xs text-[#9a9892]">
              Tokens added via plans, top-ups or adjustments.
            </p>
          </div>

          <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#9a9892]">
              Total debits
            </p>
            <p className="mt-2 text-2xl font-semibold text-[#424143]">
              {loading
                ? "—"
                : data
                ? data.stats.totalDebits
                : 0}
            </p>
            <p className="mt-1 text-xs text-[#9a9892]">
              Tokens spent on jobs, withdrawals and corrections.
            </p>
          </div>
        </section>

        {/* Filters */}
        <section className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[#424143]">
              Company
            </label>
            <FormSelect
              className="w-auto"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
            >
              <option value="ALL">All companies</option>
              {companies.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </FormSelect>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[#424143]">
              Direction
            </label>
            <FormSelect
              className="w-auto"
              value={directionFilter}
              onChange={(e) =>
                setDirectionFilter(
                  e.target.value as "ALL" | LedgerDirection,
                )
              }
            >
              <option value="ALL">All</option>
              <option value="CREDIT">Credits</option>
              <option value="DEBIT">Debits</option>
            </FormSelect>
          </div>
        </section>

        {/* Table */}
        <section className="rounded-2xl border border-[#e3e1dc] bg-white px-4 py-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">
              Recent token movements
            </h2>
            <p className="text-xs text-[#9a9892]">
              Showing up to {filteredEntries.length} entries.
            </p>
          </div>

          {loading ? (
            <LoadingState message="Loading ledger…" />
          ) : filteredEntries.length === 0 ? (
            <EmptyState title="No entries match your filters." />
          ) : (
            <DataTable>
              <THead>
                <TH>When</TH>
                <TH>Company</TH>
                <TH>Direction</TH>
                <TH>Amount</TH>
                <TH>Ticket</TH>
                <TH>User</TH>
                <TH>Reason</TH>
                <TH>Notes</TH>
                <TH>Balance</TH>
              </THead>
              <tbody>
                {filteredEntries.map((e) => {
                  const created = new Date(e.createdAt);
                  const isCredit = e.direction === "CREDIT";

                  return (
                    <tr
                      key={e.id}
                      className="border-b border-[#f0eeea] last:border-b-0"
                    >
                      <TD className="text-[#7a7a7a]">
                        {created.toLocaleDateString()}{" "}
                        {created.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TD>
                      <TD>
                        {e.company ? (
                          <>
                            <div className="font-medium">
                              {e.company.name}
                            </div>
                            <div className="text-[10px] text-[#9a9892]">
                              {e.company.slug}
                            </div>
                          </>
                        ) : (
                          "—"
                        )}
                      </TD>
                      <TD>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            isCredit
                              ? "bg-[#f0fff6] text-[#137a3a]"
                              : "bg-[#fde8e7] text-[#b13832]"
                          }`}
                        >
                          {isCredit ? "Credit" : "Debit"}
                        </span>
                      </TD>
                      <TD>
                        {isCredit ? "+" : "-"}
                        {e.amount}
                      </TD>
                      <TD>
                        {e.ticket ? (
                          <>
                            <div className="font-medium">
                              {e.ticket.code ?? "—"}
                            </div>
                            <div className="text-[10px] text-[#7a7a7a]">
                              {e.ticket.title}
                            </div>
                          </>
                        ) : (
                          "—"
                        )}
                      </TD>
                      <TD>
                        {e.user ? (
                          <>
                            <div className="font-medium">
                              {e.user.name || e.user.email}
                            </div>
                            <div className="text-[10px] text-[#9a9892]">
                              {formatRole(e.user.role as import("@prisma/client").UserRole)}
                            </div>
                          </>
                        ) : (
                          "—"
                        )}
                      </TD>
                      <TD>
                        {e.reason ?? "—"}
                      </TD>
                      <TD className="text-[#7a7a7a]">
                        {e.notes ?? "—"}
                      </TD>
                      <TD className="text-[#9a9892]">
                        {e.balanceAfter != null
                          ? e.balanceAfter
                          : "—"}
                      </TD>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          )}
        </section>
    </>
  );
}
