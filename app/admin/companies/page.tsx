// -----------------------------------------------------------------------------
// @file: app/admin/companies/page.tsx
// @purpose: Admin-facing companies overview (tokens, plan & basic counts)
// @version: v1.0.0
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
    <>
        {/* Page header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Companies overview
            </h1>
            <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
              All companies using Brandbite, with token balance and high-level
              activity metrics.
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
        <section className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--bb-text-tertiary)]">
              Total companies
            </p>
            <p className="mt-2 text-3xl font-semibold text-[var(--bb-secondary)]">
              {loading ? "—" : stats ? stats.totalCompanies : 0}
            </p>
            <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
              All companies currently in the database.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--bb-text-tertiary)]">
              Total token balance
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--bb-secondary)]">
              {loading ? "—" : stats ? stats.totalTokenBalance : 0}
            </p>
            <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
              Sum of token balances across all companies.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--bb-text-tertiary)]">
              Average balance
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--bb-secondary)]">
              {loading
                ? "—"
                : stats
                ? Math.round(stats.avgTokenBalance)
                : 0}
            </p>
            <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
              Average tokens per company.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--bb-text-tertiary)]">
              Projects & tickets
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--bb-secondary)]">
              {loading ? "—" : totalProjects}
              <span className="ml-1 text-xs font-normal text-[var(--bb-text-secondary)]">
                projects
              </span>
            </p>
            <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
              {loading
                ? ""
                : `${totalTickets} tickets across all companies.`}
            </p>
          </div>
        </section>

        {/* Filter + table */}
        <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight">
                Company list
              </h2>
              <FormSelect
                size="sm"
                className="w-auto"
                value={planFilter}
                onChange={(e) =>
                  setPlanFilter(
                    e.target.value as
                      | "ALL"
                      | "WITH_PLAN"
                      | "WITHOUT_PLAN",
                  )
                }
              >
                <option value="ALL">All</option>
                <option value="WITH_PLAN">With plan</option>
                <option value="WITHOUT_PLAN">Without plan</option>
              </FormSelect>
            </div>
            <p className="text-xs text-[var(--bb-text-tertiary)]">
              Showing {filteredCompanies.length} of {companies.length}
            </p>
          </div>

          {loading ? (
            <LoadingState message="Loading companies…" />
          ) : filteredCompanies.length === 0 ? (
            <EmptyState title="No companies match your filter." />
          ) : (
            <DataTable maxHeight="420px">
              <THead>
                <TH>Company</TH>
                <TH>Plan</TH>
                <TH align="right">Tokens</TH>
                <TH align="right">Members</TH>
                <TH align="right">Projects</TH>
                <TH align="right">Tickets</TH>
                <TH align="right">Created</TH>
              </THead>
              <tbody>
                {filteredCompanies.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-[var(--bb-border-subtle)] last:border-b-0"
                  >
                    <TD>
                      <div className="font-semibold">
                        {c.name}
                      </div>
                      <div className="text-[10px] text-[var(--bb-text-tertiary)]">
                        {c.slug}
                      </div>
                    </TD>
                    <TD>
                      {c.plan ? (
                        <>
                          <div className="font-medium">
                            {c.plan.name}
                          </div>
                          <div className="text-[10px] text-[var(--bb-text-tertiary)]">
                            {c.plan.monthlyTokens} tokens / month
                          </div>
                        </>
                      ) : (
                        <span className="text-[11px] text-[var(--bb-text-tertiary)]">
                          No plan
                        </span>
                      )}
                    </TD>
                    <TD align="right">
                      {c.tokenBalance}
                    </TD>
                    <TD align="right">
                      {c.counts.members}
                    </TD>
                    <TD align="right">
                      {c.counts.projects}
                    </TD>
                    <TD align="right">
                      {c.counts.tickets}
                    </TD>
                    <TD align="right" className="text-[var(--bb-text-tertiary)]">
                      {formatDate(c.createdAt)}
                    </TD>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </section>
    </>
  );
}
