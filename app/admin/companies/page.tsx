// -----------------------------------------------------------------------------
// @file: app/admin/companies/page.tsx
// @purpose: Admin-facing companies overview (tokens, plan & basic counts)
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-15
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";

type CompanyPlan = {
  id: string;
  name: string;
  monthlyTokens: number;
  priceCents: number | null;
  isActive: boolean;
};

type CompanyCounts = {
  members: number;
  projects: number;
  tickets: number;
};

type AdminCompany = {
  id: string;
  name: string;
  slug: string;
  tokenBalance: number;
  createdAt: string;
  updatedAt: string;
  plan: CompanyPlan | null;
  counts: CompanyCounts;
};

type AdminCompaniesResponse = {
  stats: {
    totalCompanies: number;
    totalTokenBalance: number;
    avgTokenBalance: number;
    companiesWithPlan: number;
  };
  companies: AdminCompany[];
};

export default function AdminCompaniesPage() {
  const [data, setData] = useState<AdminCompaniesResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [planFilter, setPlanFilter] = useState<"ALL" | "WITH_PLAN" | "WITHOUT_PLAN">(
    "ALL",
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/admin/companies", {
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
              "You do not have permission to view companies overview.",
            );
          }
          const msg =
            json?.error ||
            `Request failed with status ${res.status}`;
          throw new Error(msg);
        }

        if (!cancelled) {
          setData(json as AdminCompaniesResponse);
        }
      } catch (err: any) {
        console.error("Admin companies fetch error:", err);
        if (!cancelled) {
          setError(
            err?.message ||
              "Failed to load companies overview.",
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

  const companies = data?.companies ?? [];
  const stats = data?.stats;

  const filteredCompanies = useMemo(
    () =>
      companies.filter((c) => {
        if (planFilter === "WITH_PLAN") {
          return c.plan != null;
        }
        if (planFilter === "WITHOUT_PLAN") {
          return c.plan == null;
        }
        return true;
      }),
    [companies, planFilter],
  );

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString();
  };

  const totalProjects = companies.reduce(
    (sum, c) => sum + c.counts.projects,
    0,
  );
  const totalTickets = companies.reduce(
    (sum, c) => sum + c.counts.tickets,
    0,
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
            <button className="font-medium text-[#424143]">
              Companies
            </button>
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
            <button
              className="font-medium text-[#7a7a7a]"
              onClick={() =>
                (window.location.href = "/admin/token-analytics")
              }
            >
              Analytics
            </button>
            <button
              className="font-medium text-[#7a7a7a]"
              onClick={() =>
                (window.location.href = "/admin/job-types")
              }
            >
              Job types
            </button>
          </nav>
        </header>

        {/* Page header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Companies overview
            </h1>
            <p className="mt-1 text-sm text-[#7a7a7a]">
              All companies using Brandbite, with token balance and high-level
              activity metrics.
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
              Total companies
            </p>
            <p className="mt-2 text-3xl font-semibold text-[#424143]">
              {loading ? "—" : stats ? stats.totalCompanies : 0}
            </p>
            <p className="mt-1 text-xs text-[#9a9892]">
              All companies currently in the database.
            </p>
          </div>

          <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#9a9892]">
              Total token balance
            </p>
            <p className="mt-2 text-2xl font-semibold text-[#424143]">
              {loading ? "—" : stats ? stats.totalTokenBalance : 0}
            </p>
            <p className="mt-1 text-xs text-[#9a9892]">
              Sum of token balances across all companies.
            </p>
          </div>

          <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#9a9892]">
              Average balance
            </p>
            <p className="mt-2 text-2xl font-semibold text-[#424143]">
              {loading
                ? "—"
                : stats
                ? Math.round(stats.avgTokenBalance)
                : 0}
            </p>
            <p className="mt-1 text-xs text-[#9a9892]">
              Average tokens per company.
            </p>
          </div>

          <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#9a9892]">
              Projects & tickets
            </p>
            <p className="mt-2 text-2xl font-semibold text-[#424143]">
              {loading ? "—" : totalProjects}
              <span className="ml-1 text-xs font-normal text-[#7a7a7a]">
                projects
              </span>
            </p>
            <p className="mt-1 text-xs text-[#9a9892]">
              {loading
                ? ""
                : `${totalTickets} tickets across all companies.`}
            </p>
          </div>
        </section>

        {/* Filter + table */}
        <section className="rounded-2xl border border-[#e3e1dc] bg-white px-4 py-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight">
                Company list
              </h2>
              <select
                value={planFilter}
                onChange={(e) =>
                  setPlanFilter(
                    e.target.value as
                      | "ALL"
                      | "WITH_PLAN"
                      | "WITHOUT_PLAN",
                  )
                }
                className="rounded-md border border-[#d4d2cc] bg-[#fbfaf8] px-2 py-1 text-xs text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
              >
                <option value="ALL">All</option>
                <option value="WITH_PLAN">With plan</option>
                <option value="WITHOUT_PLAN">Without plan</option>
              </select>
            </div>
            <p className="text-xs text-[#9a9892]">
              Showing {filteredCompanies.length} of {companies.length}
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
            <div className="max-h-[420px] overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#e3e1dc] text-xs uppercase tracking-[0.08em] text-[#9a9892]">
                    <th className="px-2 py-2">Company</th>
                    <th className="px-2 py-2">Plan</th>
                    <th className="px-2 py-2 text-right">
                      Tokens
                    </th>
                    <th className="px-2 py-2 text-right">
                      Members
                    </th>
                    <th className="px-2 py-2 text-right">
                      Projects
                    </th>
                    <th className="px-2 py-2 text-right">
                      Tickets
                    </th>
                    <th className="px-2 py-2 text-right">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCompanies.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-[#f0eeea] text-xs last:border-b-0"
                    >
                      <td className="px-2 py-2 align-top text-[11px] text-[#424143]">
                        <div className="font-semibold">
                          {c.name}
                        </div>
                        <div className="text-[10px] text-[#9a9892]">
                          {c.slug}
                        </div>
                      </td>
                      <td className="px-2 py-2 align-top text-[11px] text-[#424143]">
                        {c.plan ? (
                          <>
                            <div className="font-medium">
                              {c.plan.name}
                            </div>
                            <div className="text-[10px] text-[#9a9892]">
                              {c.plan.monthlyTokens} tokens / month
                            </div>
                          </>
                        ) : (
                          <span className="text-[11px] text-[#9a9892]">
                            No plan
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 align-top text-right text-[11px] text-[#424143]">
                        {c.tokenBalance}
                      </td>
                      <td className="px-2 py-2 align-top text-right text-[11px] text-[#424143]">
                        {c.counts.members}
                      </td>
                      <td className="px-2 py-2 align-top text-right text-[11px] text-[#424143]">
                        {c.counts.projects}
                      </td>
                      <td className="px-2 py-2 align-top text-right text-[11px] text-[#424143]">
                        {c.counts.tickets}
                      </td>
                      <td className="px-2 py-2 align-top text-right text-[11px] text-[#9a9892]">
                        {formatDate(c.createdAt)}
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
