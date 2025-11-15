// -----------------------------------------------------------------------------
// @file: app/admin/plans/page.tsx
// @purpose: Admin-facing management of subscription plans
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-15
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";

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

export default function AdminPlansPage() {
  const [data, setData] = useState<PlansResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Plan | null>(null);
  const [name, setName] = useState("");
  const [monthlyTokens, setMonthlyTokens] = useState("");
  const [priceCents, setPriceCents] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const plans = data?.plans ?? [];

  const activeCount = useMemo(
    () => plans.filter((p) => p.isActive).length,
    [plans],
  );
  const totalMonthlyTokens = useMemo(
    () => plans.reduce((sum, p) => sum + p.monthlyTokens, 0),
    [plans],
  );

  const resetForm = () => {
    setSelected(null);
    setName("");
    setMonthlyTokens("");
    setPriceCents("");
    setIsActive(true);
    setSaveError(null);
    setSaveSuccess(null);
  };

  const fillFormFromPlan = (plan: Plan) => {
    setSelected(plan);
    setName(plan.name);
    setMonthlyTokens(String(plan.monthlyTokens));
    setPriceCents(
      plan.priceCents != null ? String(plan.priceCents) : "",
    );
    setIsActive(plan.isActive);
    setSaveError(null);
    setSaveSuccess(null);
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/plans", {
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
            "You do not have permission to manage plans.",
          );
        }
        const msg =
          json?.error || `Request failed with status ${res.status}`;
        throw new Error(msg);
      }

      setData(json as PlansResponse);
    } catch (err: any) {
      console.error("Admin plans fetch error:", err);
      setError(
        err?.message || "Failed to load plans.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (cancelled) return;
      await load();
    };

    run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClickPlan = (plan: Plan) => {
    fillFormFromPlan(plan);
  };

  const handleNewPlan = () => {
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const mt = parseInt(monthlyTokens, 10);
      if (!Number.isFinite(mt) || mt <= 0) {
        throw new Error("Monthly tokens must be a positive number.");
      }

      const payload: any = {
        name: name.trim(),
        monthlyTokens: mt,
        isActive,
      };

      if (priceCents.trim() !== "") {
        const pc = parseInt(priceCents, 10);
        if (!Number.isFinite(pc) || pc < 0) {
          throw new Error(
            "Price (cents) must be a non-negative number.",
          );
        }
        payload.priceCents = pc;
      } else {
        payload.priceCents = null;
      }

      const isEditing = !!selected;

      const res = await fetch("/api/admin/plans", {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          isEditing
            ? { id: selected?.id, ...payload }
            : payload,
        ),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          json?.error || `Request failed with status ${res.status}`;
        throw new Error(msg);
      }

      setSaveSuccess(
        isEditing
          ? "Plan updated successfully."
          : "Plan created successfully.",
      );

      await load();

      if (!isEditing) {
        resetForm();
      }
    } catch (err: any) {
      console.error("Admin plans save error:", err);
      setSaveError(
        err?.message || "Failed to save plan.",
      );
    } finally {
      setSaving(false);
    }
  };

  const formatPrice = (priceCents: number | null) => {
    if (priceCents == null) return "—";
    const euros = priceCents / 100;
    return `€${euros.toFixed(2)}`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString();
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
            <button className="font-medium text-[#424143]">
              Plans
            </button>
          </nav>
        </header>

        {/* Page header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Plans
            </h1>
            <p className="mt-1 text-sm text-[#7a7a7a]">
              Configure subscription plans with monthly tokens and pricing.
            </p>
          </div>
          <button
            type="button"
            onClick={handleNewPlan}
            className="inline-flex items-center justify-center rounded-full bg-[#f15b2b] px-4 py-2 text-sm font-semibold text-white shadow-sm"
          >
            New plan
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-red-700">
            <p className="font-medium">Error</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {/* Summary cards */}
        <section className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#9a9892]">
              Total plans
            </p>
            <p className="mt-2 text-3xl font-semibold text-[#424143]">
              {loading ? "—" : plans.length}
            </p>
            <p className="mt-1 text-xs text-[#9a9892]">
              All configured plans.
            </p>
          </div>
          <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#9a9892]">
              Active
            </p>
            <p className="mt-2 text-2xl font-semibold text-[#424143]">
              {loading ? "—" : activeCount}
            </p>
            <p className="mt-1 text-xs text-[#9a9892]">
              Plans currently available for assignment.
            </p>
          </div>
          <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#9a9892]">
              Total monthly tokens
            </p>
            <p className="mt-2 text-2xl font-semibold text-[#424143]">
              {loading ? "—" : totalMonthlyTokens}
            </p>
            <p className="mt-1 text-xs text-[#9a9892]">
              Sum of monthly tokens across all plans.
            </p>
          </div>
        </section>

        {/* Table + Form */}
        <section className="grid gap-4 md:grid-cols-[3fr,2fr]">
          {/* List */}
          <div className="rounded-2xl border border-[#e3e1dc] bg-white px-4 py-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight">
                Plan list
              </h2>
              <p className="text-xs text-[#9a9892]">
                Click a row to edit.
              </p>
            </div>

            {loading ? (
              <div className="py-6 text-center text-sm text-[#7a7a7a]">
                Loading plans…
              </div>
            ) : plans.length === 0 ? (
              <div className="py-6 text-center text-sm text-[#9a9892]">
                No plans defined yet.
              </div>
            ) : (
              <div className="max-h-[420px] overflow-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#e3e1dc] text-xs uppercase tracking-[0.08em] text-[#9a9892]">
                      <th className="px-2 py-2">Name</th>
                      <th className="px-2 py-2 text-right">
                        Monthly tokens
                      </th>
                      <th className="px-2 py-2 text-right">
                        Price
                      </th>
                      <th className="px-2 py-2 text-center">
                        Status
                      </th>
                      <th className="px-2 py-2 text-right">
                        Companies
                      </th>
                      <th className="px-2 py-2 text-right">
                        Updated
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((p) => (
                      <tr
                        key={p.id}
                        className={`border-b border-[#f0eeea] text-xs last:border-b-0 ${
                          selected?.id === p.id
                            ? "bg-[#fff5ef]"
                            : "bg-white"
                        } cursor-pointer`}
                        onClick={() => handleClickPlan(p)}
                      >
                        <td className="px-2 py-2 align-top text-[11px] text-[#424143]">
                          <div className="font-semibold">
                            {p.name}
                          </div>
                        </td>
                        <td className="px-2 py-2 align-top text-right text-[11px] text-[#424143]">
                          {p.monthlyTokens}
                        </td>
                        <td className="px-2 py-2 align-top text-right text-[11px] text-[#424143]">
                          {formatPrice(p.priceCents)}
                        </td>
                        <td className="px-2 py-2 align-top text-center text-[11px]">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              p.isActive
                                ? "bg-[#f0fff6] text-[#137a3a]"
                                : "bg-[#f5f3f0] text-[#9a9892]"
                            }`}
                          >
                            {p.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-2 py-2 align-top text-right text-[11px] text-[#424143]">
                          {p.attachedCompanies}
                        </td>
                        <td className="px-2 py-2 align-top text-right text-[11px] text-[#9a9892]">
                          {formatDate(p.updatedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Form */}
          <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
            <h2 className="text-sm font-semibold tracking-tight">
              {selected ? "Edit plan" : "Create new plan"}
            </h2>
            <p className="mt-1 text-xs text-[#7a7a7a]">
              Monthly tokens control how many tokens are added to the
              company every billing cycle.
            </p>

            {saveError && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {saveError}
              </div>
            )}

            {saveSuccess && (
              <div className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
                {saveSuccess}
              </div>
            )}

            <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="plan-name"
                  className="text-xs font-medium text-[#424143]"
                >
                  Name
                </label>
                <input
                  id="plan-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full rounded-md border border-[#d4d2cc] bg-[#fbfaf8] px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
                  placeholder="e.g. Basic, Pro, Full"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="plan-monthly-tokens"
                  className="text-xs font-medium text-[#424143]"
                >
                  Monthly tokens
                </label>
                <input
                  id="plan-monthly-tokens"
                  type="number"
                  min={1}
                  value={monthlyTokens}
                  onChange={(e) => setMonthlyTokens(e.target.value)}
                  required
                  className="w-full rounded-md border border-[#d4d2cc] bg-[#fbfaf8] px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
                  placeholder="e.g. 100, 200, 400"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="plan-price-cents"
                  className="text-xs font-medium text-[#424143]"
                >
                  Price (in cents, optional)
                </label>
                <input
                  id="plan-price-cents"
                  type="number"
                  min={0}
                  value={priceCents}
                  onChange={(e) => setPriceCents(e.target.value)}
                  className="w-full rounded-md border border-[#d4d2cc] bg-[#fbfaf8] px-3 py-2 text-sm text-[#424143] outline-none focus:border-[#f15b2b] focus:ring-1 focus:ring-[#f15b2b]"
                  placeholder="e.g. 4900 for €49.00"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-medium text-[#424143]">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-3 w-3 rounded border-[#d4d2cc] text-[#f15b2b] focus:ring-[#f15b2b]"
                  />
                  Active
                </label>

                {selected && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-xs font-medium text-[#7a7a7a]"
                  >
                    Clear selection
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={saving}
                className="mt-2 inline-flex items-center justify-center rounded-full bg-[#f15b2b] px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
              >
                {saving
                  ? "Saving…"
                  : selected
                  ? "Save changes"
                  : "Create plan"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
