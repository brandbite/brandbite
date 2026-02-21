// -----------------------------------------------------------------------------
// @file: app/admin/token-analytics/page.tsx
// @purpose: Admin-facing token analytics (global + per company)
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-15
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import { InlineAlert } from "@/components/ui/inline-alert";
import { EmptyState } from "@/components/ui/empty-state";
import { FormSelect } from "@/components/ui/form-field";
import { LoadingState } from "@/components/ui/loading-state";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type CompanyAnalytics = {
  companyId: string;
  company: {
    id: string;
    name: string;
    slug: string;
  } | null;
  totalCredits: number;
  totalDebits: number;
  netTokens: number;
  entriesCount: number;
};

type TokenAnalyticsResponse = {
  stats: {
    globalCredits: number;
    globalDebits: number;
    globalNet: number;
    companiesWithLedger: number;
    ledgerEntriesCount: number;
  };
  perCompany: CompanyAnalytics[];
};

export default function AdminTokenAnalyticsPage() {
  const [data, setData] = useState<TokenAnalyticsResponse | null>(
    null,
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [companyFilter, setCompanyFilter] = useState<string>("ALL");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/admin/token-analytics", {
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
              "You do not have permission to view token analytics.",
            );
          }
          const msg =
            json?.error ||
            `Request failed with status ${res.status}`;
          throw new Error(msg);
        }

        if (!cancelled) {
          setData(json as TokenAnalyticsResponse);
        }
      } catch (err: any) {
        console.error("Admin token analytics fetch error:", err);
        if (!cancelled) {
          setError(
            err?.message ||
              "Failed to load token analytics.",
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

  const stats = data?.stats;
  const companies = data?.perCompany ?? [];

  const companyNames = useMemo(
    () =>
      Array.from(
        new Set(
          companies
            .map((c) => c.company?.name)
            .filter((n): n is string => !!n),
        ),
      ),
    [companies],
  );

  const filteredCompanies = useMemo(
    () =>
      companies.filter((c) => {
        if (companyFilter === "ALL") return true;
        return c.company?.name === companyFilter;
      }),
    [companies, companyFilter],
  );

  const chartData = useMemo(
    () =>
      filteredCompanies.map((c) => ({
        name: c.company?.name ?? "Unknown",
        netTokens: c.netTokens,
      })),
    [filteredCompanies],
  );

  return (
    <>
        {/* Page header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Token analytics
            </h1>
            <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
              High-level overview of token movements across all
              companies.
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <InlineAlert variant="error" title="Something went wrong" className="mb-4">
            {error}
          </InlineAlert>
        )}

        {/* Summary cards */}
        <section className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--bb-text-tertiary)]">
              Net tokens
            </p>
            <p className="mt-2 text-3xl font-semibold text-[var(--bb-primary)]">
              {loading
                ? "—"
                : stats
                ? stats.globalNet
                : 0}
            </p>
            <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
              Total credits minus debits across all companies.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--bb-text-tertiary)]">
              Total credits
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--bb-secondary)]">
              {loading
                ? "—"
                : stats
                ? stats.globalCredits
                : 0}
            </p>
            <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
              Tokens added via plans, top-ups, bonuses, etc.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--bb-text-tertiary)]">
              Total debits
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--bb-secondary)]">
              {loading
                ? "—"
                : stats
                ? stats.globalDebits
                : 0}
            </p>
            <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
              Tokens spent on jobs, withdrawals and corrections.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--bb-text-tertiary)]">
              Companies with activity
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--bb-secondary)]">
              {loading
                ? "—"
                : stats
                ? stats.companiesWithLedger
                : 0}
            </p>
            <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
              Companies that have at least one ledger entry.
            </p>
          </div>
        </section>

        {/* Filter bar */}
        <section className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[var(--bb-secondary)]">
              Company
            </label>
            <FormSelect
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="w-auto"
            >
              <option value="ALL">All companies</option>
              {companyNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </FormSelect>
          </div>
        </section>

        {/* Chart + table */}
        <section className="grid gap-4 md:grid-cols-[3fr_4fr]">
          {/* Chart */}
          <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight">
                Net tokens by company
              </h2>
              <p className="text-xs text-[var(--bb-text-tertiary)]">
                Shows filtered companies only.
              </p>
            </div>
            {loading ? (
              <LoadingState message="Loading chart…" />
            ) : chartData.length === 0 ? (
              <EmptyState title="No data to display." description="Token activity will appear here once companies start using tokens." />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: any) => [
                        value,
                        "Net tokens",
                      ]}
                    />
                    <Bar
                      dataKey="netTokens"
                      // color is left to Recharts default styling
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight">
                Companies overview
              </h2>
              <p className="text-xs text-[var(--bb-text-tertiary)]">
                Sorted by net tokens (descending).
              </p>
            </div>

            {loading ? (
              <LoadingState message="Loading companies…" />
            ) : filteredCompanies.length === 0 ? (
              <EmptyState title="No companies match your filter." description="Try selecting a different company or choose 'All companies'." />
            ) : (
              <div className="max-h-80 overflow-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--bb-border)] text-xs uppercase tracking-[0.08em] text-[var(--bb-text-tertiary)]">
                      <th className="px-2 py-2">Company</th>
                      <th className="px-2 py-2 text-right">
                        Credits
                      </th>
                      <th className="px-2 py-2 text-right">
                        Debits
                      </th>
                      <th className="px-2 py-2 text-right">
                        Net
                      </th>
                      <th className="px-2 py-2 text-right">
                        Entries
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompanies.map((c) => (
                      <tr
                        key={c.companyId}
                        className="border-b border-[var(--bb-border-subtle)] text-xs last:border-b-0"
                      >
                        <td className="px-2 py-2 align-top text-[11px] text-[var(--bb-secondary)]">
                          {c.company ? (
                            <>
                              <div className="font-medium">
                                {c.company.name}
                              </div>
                              <div className="text-[10px] text-[var(--bb-text-tertiary)]">
                                {c.company.slug}
                              </div>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-2 py-2 align-top text-right text-[11px] text-[var(--bb-secondary)]">
                          {c.totalCredits}
                        </td>
                        <td className="px-2 py-2 align-top text-right text-[11px] text-[var(--bb-secondary)]">
                          {c.totalDebits}
                        </td>
                        <td className="px-2 py-2 align-top text-right text-[11px] text-[var(--bb-secondary)]">
                          {c.netTokens}
                        </td>
                        <td className="px-2 py-2 align-top text-right text-[11px] text-[var(--bb-text-tertiary)]">
                          {c.entriesCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
    </>
  );
}
