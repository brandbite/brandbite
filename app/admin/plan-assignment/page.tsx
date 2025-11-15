// -----------------------------------------------------------------------------
// @file: app/admin/plan-assignment/page.tsx
// @purpose: Admin-facing UI to assign subscription plans to companies
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

type Plan = {
  id: string;
  name: string;
  monthlyTokens: number;
  priceCents: number | null;
  isActive: boolean;
  attachedCompanies: number;
  createdAt: string;
  updatedAt: string;
};

type PlansResponse = {
  plans: Plan[];
};

export default function AdminPlanAssignmentPage() {
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [savingCompanyId, setSavingCompanyId] = useState<string | null>(
    null,
  );
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const [companiesRes, plansRes] = await Promise.all([
          fetch("/api/admin/companies", { cache: "no-store" }),
          fetch("/api/admin/plans", { cache: "no-store" }),
        ]);

        const companiesJson = await companiesRes.json().catch(() => null);
        const plansJson = await plansRes.json().catch(() => null);

        if (!companiesRes.ok) {
          if (companiesRes.status === 401) {
            throw new Error(
              "You must be signed in as an admin to view this page.",
            );
          }
          if (companiesRes.status === 403) {
            throw new Error(
              "You do not have permission to view companies.",
            );
          }
          const msg =
            companiesJson?.error ||
            `Companies request failed with status ${companiesRes.status}`;
          throw new Error(msg);
        }

        if (!plansRes.ok) {
          if (plansRes.status === 401) {
            throw new Error(
              "You must be signed in as an admin to view plans.",
            );
          }
          if (plansRes.status === 403) {
            throw new Error(
              "You do not have permission to view plans.",
            );
          }
          const msg =
            plansJson?.error ||
            `Plans request failed with status ${plansRes.status}`;
          throw new Error(msg);
        }

        if (!cancelled) {
          setCompanies(
            (companiesJson as AdminCompaniesResponse)
              .companies ?? [],
          );
          setPlans((plansJson as PlansResponse).plans ?? []);
        }
      } catch (err: any) {
        console.error("Admin plan assignment fetch error:", err);
        if (!cancelled) {
          setError(
            err?.message ||
              "Failed to load companies or plans.",
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

  const activePlans = useMemo(
    () => plans.filter((p) => p.isActive),
    [plans],
  );

  const formatPrice = (priceCents: number | null) => {
    if (priceCents == null) return "—";
    const euros = priceCents / 100;
    return `€${euros.toFixed(2)}`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString();
  };

  const handleChangePlan = async (
    companyId: string,
    newPlanId: string,
  ) => {
    setSavingCompanyId(companyId);
    setSaveMessage(null);
    setSaveError(null);

    try {
      const planId = newPlanId === "" ? null : newPlanId;

      const res = await fetch("/api/admin/plan-assignment", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId,
          planId,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          json?.error || `Request failed with status ${res.status}`;
        throw new Error(msg);
      }

      const updated = json?.company as AdminCompany | undefined;
      if (updated) {
        setCompanies((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c)),
        );
      }

      setSaveMessage("Plan updated successfully.");
    } catch (err: any) {
      console.error("Plan assignment save error:", err);
      setSaveError(
        err?.message || "Failed to update plan.",
      );
    } finally {
      setSavingCompanyId(null);
    }
  };

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
              onClick={() => (window.location.href = "/admin/companies")}
            >
              Companies
            </button>
            <button
              className="font-medium text-[#7a7a7a]"
              onClick={() => (window.location.href = "/admin/plans")}
            >
              Plans
            </button>
            <button className="font-medium text-[#424143]">
              Plan assignment
            </button>
          </nav>
        </header>

        {/* Page header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Plan assignment
            </h1>
            <p className="mt-1 text-sm text-[#7a7a7a]">
              Link companies to subscription plans. This does not change
              balances automatically; it only controls which plan they
              belong to.
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

        {/* Info / status */}
        {(saveMessage || saveError) && (
          <div className="mb-4 flex flex-wrap gap-3">
            {saveMessage && (
              <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
                {saveMessage}
              </div>
            )}
            {saveError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {saveError}
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <section className="rounded-2xl border border-[#e3e1dc] bg-white px-4 py-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">
              Companies and plans
            </h2>
            <p className="text-xs text-[#9a9892]">
              Showing {companies.length} companies, {activePlans.length} active plans.
            </p>
          </div>

          {loading ? (
            <div className="py-6 text-center text-sm text-[#7a7a7a]">
              Loading companies and plans…
            </div>
          ) : companies.length === 0 ? (
            <div className="py-6 text-center text-sm text-[#9a9892]">
              No companies found.
            </div>
          ) : (
            <div className="max-h-[480px] overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#e3e1dc] text-xs uppercase tracking-[0.08em] text-[#9a9892]">
                    <th className="px-2 py-2">Company</th>
                    <th className="px-2 py-2 text-right">
                      Tokens
                    </th>
                    <th className="px-2 py-2 text-right">
                      Projects
                    </th>
                    <th className="px-2 py-2 text-right">
                      Tickets
                    </th>
                    <th className="px-2 py-2">Current plan</th>
                    <th className="px-2 py-2 text-right">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c) => {
                    const isSaving = savingCompanyId === c.id;

                    return (
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
                        <td className="px-2 py-2 align-top text-right text-[11px] text-[#424143]">
                          {c.tokenBalance}
                        </td>
                        <td className="px-2 py-2 align-top text-right text-[11px] text-[#424143]">
                          {c.counts.projects}
                        </td>
                        <td className="px-2 py-2 align-top text-right text-[11px] text-[#424143]">
                          {c.counts.tickets}
                        </td>
                        <td className="px-2 py-2 align-top text-[11px] text-[#424143]">
                          <div className="flex flex-col gap-1">
                            <select
                              disabled={isSaving || activePlans.length === 0}
                              value={c.plan?.id ?? ""}
                              onChange={(e) =>
                                handleChangePlan(
                                  c.id,
                                  e.target.value,
                                )
                              }
                              className="w-full rounded-md border border-[#d4d2cc] bg-[#fbfaf8] px-2 py-1 text-[11px] text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
                            >
                              <option value="">
                                No plan assigned
                              </option>
                              {activePlans.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.monthlyTokens} tokens)
                                </option>
                              ))}
                            </select>
                            {c.plan && (
                              <div className="text-[10px] text-[#9a9892]">
                                {formatPrice(c.plan.priceCents)}
                                {c.plan.isActive
                                  ? " • active"
                                  : " • inactive"}
                              </div>
                            )}
                            {isSaving && (
                              <div className="text-[10px] text-[#9a9892]">
                                Saving…
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2 align-top text-right text-[11px] text-[#9a9892]">
                          {formatDate(c.createdAt)}
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
    </div>
  );
}
