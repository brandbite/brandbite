// -----------------------------------------------------------------------------
// @file: app/admin/token-analytics/page.tsx
// @purpose: Admin-facing token analytics (global + per company)
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-15
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
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
            <button
              className="font-medium text-[#7a7a7a]"
              onClick={() =>
                (window.location.href = "/admin/withdrawals")
              }
            >
              Withdrawals
            </button>
            <button className="font-medium text-[#424143]">
              Analytics
            </button>
          </nav>
        </header>

        {/* Page header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Token analytics
            </h1>
            <p className="mt-1 text-sm text-[#7a7a7a]">
              High-level overview of token movements across all
              companies.
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
        <section className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#9a9892]">
              Net tokens
            </p>
            <p className="mt-2 text-3xl font-semibold text-[#f15b2b]">
              {loading
                ? "—"
                : stats
                ? stats.globalNet
                : 0}
            </p>
            <p className="mt-1 text-xs text-[#9a9892]">
              Total credits minus debits across all companies.
            </p>
          </div>

          <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#9a9892]">
              Total credits
            </p>
            <p className="mt-2 text-2xl font-semibold text-[#424143]">
              {loading
                ? "—"
                : stats
                ? stats.globalCredits
                : 0}
            </p>
            <p className="mt-1 text-xs text-[#9a9892]">
              Tokens added via plans, top-ups, bonuses, etc.
            </p>
          </div>

          <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#9a9892]">
              Total debits
            </p>
            <p className="mt-2 text-2xl font-semibold text-[#424143]">
              {loading
                ? "—"
                : stats
                ? stats.globalDebits
                : 0}
            </p>
            <p className="mt-1 text-xs text-[#9a9892]">
              Tokens spent on jobs, withdrawals and corrections.
            </p>
          </div>

          <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#9a9892]">
              Companies with activity
            </p>
            <p className="mt-2 text-2xl font-semibold text-[#424143]">
              {loading
                ? "—"
                : stats
                ? stats.companiesWithLedger
                : 0}
            </p>
            <p className="mt-1 text-xs text-[#9a9892]">
              Companies that have at least one ledger entry.
            </p>
          </div>
        </section>

        {/* Filter bar */}
        <section className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[#424143]">
              Company
            </label>
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="rounded-md border border-[#d4d2cc] bg-[#fbfaf8] px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
            >
              <option value="ALL">All companies</option>
              {companyNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Chart + table */}
        <section className="grid gap-4 md:grid-cols-[3fr,4fr]">
          {/* Chart */}
          <div className="rounded-2xl border border-[#e3e1dc] bg-white px-4 py-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight">
                Net tokens by company
              </h2>
              <p className="text-xs text-[#9a9892]">
                Shows filtered companies only.
              </p>
            </div>
            {loading ? (
              <div className="py-6 text-center text-sm text-[#7a7a7a]">
                Loading chart…
              </div>
            ) : chartData.length === 0 ? (
              <div className="py-6 text-center text-sm text-[#9a9892]">
                No data to display.
              </div>
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
          <div className="rounded-2xl border border-[#e3e1dc] bg-white px-4 py-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight">
                Companies overview
              </h2>
              <p className="text-xs text-[#9a9892]">
                Sorted by net tokens (descending).
              </p>
            </div>

            {loading ? (
              <div className="py-6 text-center text-sm text-[#7a7a7a]">
                Loading companies…
              </div>
            ) : filteredCompanies.length === 0 ? (
              <div className="py-6 text-center text-sm text-[#9a9892]">
                No companies match your filter.
              </div>
            ) : (
              <div className="max-h-80 overflow-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#e3e1dc] text-xs uppercase tracking-[0.08em] text-[#9a9892]">
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
                        className="border-b border-[#f0eeea] text-xs last:border-b-0"
                      >
                        <td className="px-2 py-2 align-top text-[11px] text-[#424143]">
                          {c.company ? (
                            <>
                              <div className="font-medium">
                                {c.company.name}
                              </div>
                              <div className="text-[10px] text-[#9a9892]">
                                {c.company.slug}
                              </div>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-2 py-2 align-top text-right text-[11px] text-[#424143]">
                          {c.totalCredits}
                        </td>
                        <td className="px-2 py-2 align-top text-right text-[11px] text-[#424143]">
                          {c.totalDebits}
                        </td>
                        <td className="px-2 py-2 align-top text-right text-[11px] text-[#424143]">
                          {c.netTokens}
                        </td>
                        <td className="px-2 py-2 align-top text-right text-[11px] text-[#9a9892]">
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
      </div>
    </div>
  );
}
