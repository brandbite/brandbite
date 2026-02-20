// -----------------------------------------------------------------------------
// @file: app/admin/job-types/page.tsx
// @purpose: Admin-facing management of job types (estimated hours → auto pricing)
// @version: v2.0.0
// @status: active
// @lastUpdate: 2025-12-27
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { useToast } from "@/components/ui/toast-provider";
import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/ui/form-field";
import { FormTextarea } from "@/components/ui/form-field";
import { FormSelect } from "@/components/ui/form-field";
import { LoadingState } from "@/components/ui/loading-state";
import { Badge } from "@/components/ui/badge";

type JobType = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  tokenCost: number;
  designerPayoutTokens: number;
  estimatedHours: number | null;
  hasQuantity: boolean;
  quantityLabel: string | null;
  defaultQuantity: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type JobTypesResponse = {
  jobTypes: JobType[];
};

export default function AdminJobTypesPage() {
  const { showToast } = useToast();
  const [data, setData] = useState<JobTypesResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [filterActive, setFilterActive] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  const [selected, setSelected] = useState<JobType | null>(null);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formEstimatedHours, setFormEstimatedHours] = useState("");
  const [formHasQuantity, setFormHasQuantity] = useState(false);
  const [formQuantityLabel, setFormQuantityLabel] = useState("");
  const [formDefaultQuantity, setFormDefaultQuantity] = useState("1");
  const [formIsActive, setFormIsActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const jobTypes = data?.jobTypes ?? [];

  const filteredJobTypes = useMemo(() => {
    return jobTypes.filter((jt) => {
      if (filterActive === "ACTIVE") return jt.isActive;
      if (filterActive === "INACTIVE") return !jt.isActive;
      return true;
    });
  }, [jobTypes, filterActive]);

  const activeCount = jobTypes.filter((jt) => jt.isActive).length;
  const inactiveCount = jobTypes.length - activeCount;

  // Derived token values (auto-calculated from estimated hours)
  const derivedTokenCost = formEstimatedHours
    ? parseInt(formEstimatedHours, 10) || 0
    : 0;
  const derivedDesignerPayout = Math.round(derivedTokenCost * 0.6);

  const resetForm = () => {
    setSelected(null);
    setFormName("");
    setFormCategory("");
    setFormDescription("");
    setFormEstimatedHours("");
    setFormHasQuantity(false);
    setFormQuantityLabel("");
    setFormDefaultQuantity("1");
    setFormIsActive(true);
    setSaveError(null);
    setSaveSuccess(null);
  };

  const fillFormFromSelection = (jt: JobType) => {
    setSelected(jt);
    setFormName(jt.name);
    setFormCategory(jt.category ?? "");
    setFormDescription(jt.description ?? "");
    // Fallback to tokenCost for legacy rows where estimatedHours was not set
    setFormEstimatedHours(
      String(jt.estimatedHours ?? jt.tokenCost),
    );
    setFormHasQuantity(jt.hasQuantity);
    setFormQuantityLabel(jt.quantityLabel ?? "");
    setFormDefaultQuantity(String(jt.defaultQuantity));
    setFormIsActive(jt.isActive);
    setSaveError(null);
    setSaveSuccess(null);
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/job-types", {
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
            "You do not have permission to manage job types.",
          );
        }
        const msg =
          json?.error || `Request failed with status ${res.status}`;
        throw new Error(msg);
      }

      setData(json as JobTypesResponse);
    } catch (err: any) {
      console.error("Admin job types fetch error:", err);
      setError(
        err?.message || "Failed to load job types.",
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

  const handleEditClick = (jt: JobType) => {
    fillFormFromSelection(jt);
  };

  const handleNewClick = () => {
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const estimatedHours = parseInt(formEstimatedHours, 10);

      const payload = {
        name: formName.trim(),
        category: formCategory.trim() || null,
        description: formDescription.trim() || null,
        estimatedHours,
        hasQuantity: formHasQuantity,
        quantityLabel: formHasQuantity ? formQuantityLabel.trim() || null : null,
        defaultQuantity: formHasQuantity
          ? Math.max(1, parseInt(formDefaultQuantity, 10) || 1)
          : 1,
        isActive: formIsActive,
      };

      const isEditing = !!selected;

      const res = await fetch("/api/admin/job-types", {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          isEditing
            ? {
                id: selected?.id,
                ...payload,
              }
            : payload,
        ),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          json?.error || `Request failed with status ${res.status}`;
        throw new Error(msg);
      }

      const msg = isEditing
        ? "Job type updated successfully."
        : "Job type created successfully.";
      setSaveSuccess(msg);
      showToast({ type: "success", title: msg });

      await load();

      if (!isEditing) {
        resetForm();
      }
    } catch (err: any) {
      console.error("Admin job types save error:", err);
      const errMsg = err?.message || "Failed to save job type.";
      setSaveError(errMsg);
      showToast({ type: "error", title: errMsg });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString();
  };

  return (
    <>
        {/* Page header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Job types
            </h1>
            <p className="mt-1 text-sm text-[#7a7a7a]">
              Set estimated hours for each job type. Token cost and designer
              payout are calculated automatically.
            </p>
          </div>
          <Button onClick={handleNewClick}>New job type</Button>
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
              Total job types
            </p>
            <p className="mt-2 text-3xl font-semibold text-[#424143]">
              {loading ? "\u2014" : jobTypes.length}
            </p>
            <p className="mt-1 text-xs text-[#9a9892]">
              All configured job types.
            </p>
          </div>
          <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#9a9892]">
              Active
            </p>
            <p className="mt-2 text-2xl font-semibold text-[#424143]">
              {loading ? "\u2014" : activeCount}
            </p>
            <p className="mt-1 text-xs text-[#9a9892]">
              Job types available to customers.
            </p>
          </div>
          <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#9a9892]">
              Inactive
            </p>
            <p className="mt-2 text-2xl font-semibold text-[#424143]">
              {loading ? "\u2014" : inactiveCount}
            </p>
            <p className="mt-1 text-xs text-[#9a9892]">
              Hidden job types kept for history.
            </p>
          </div>
        </section>

        {/* Filter + table + form layout */}
        <section className="grid gap-4 md:grid-cols-[3fr_2fr]">
          {/* Left: table */}
          <div className="rounded-2xl border border-[#e3e1dc] bg-white px-4 py-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight">
                  Job type list
                </h2>
                <FormSelect
                  value={filterActive}
                  onChange={(e) =>
                    setFilterActive(
                      e.target.value as "ALL" | "ACTIVE" | "INACTIVE",
                    )
                  }
                  size="sm"
                  className="w-auto"
                >
                  <option value="ALL">All</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </FormSelect>
              </div>
              <p className="text-xs text-[#9a9892]">
                Showing {filteredJobTypes.length} of {jobTypes.length}
              </p>
            </div>

            {loading ? (
              <LoadingState message="Loading job types\u2026" />
            ) : filteredJobTypes.length === 0 ? (
              <EmptyState title="No job types match your filter." />
            ) : (
              <div className="max-h-[420px] overflow-y-auto overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#e3e1dc] text-xs uppercase tracking-[0.08em] text-[#9a9892]">
                      <th className="px-2 py-2">Name</th>
                      <th className="px-2 py-2">Category</th>
                      <th className="px-2 py-2 text-right">Est. Hours</th>
                      <th className="px-2 py-2 text-center">Qty</th>
                      <th className="px-2 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJobTypes.map((jt) => (
                      <tr
                        key={jt.id}
                        className={`border-b border-[#f0eeea] text-xs last:border-b-0 ${
                          selected?.id === jt.id
                            ? "bg-[#fff5ef]"
                            : "bg-white"
                        } cursor-pointer`}
                        onClick={() => handleEditClick(jt)}
                      >
                        <td className="px-2 py-2 align-top text-[11px] text-[#424143]">
                          <div className="font-semibold">{jt.name}</div>
                          {jt.description && (
                            <div className="mt-0.5 text-[10px] text-[#7a7a7a] line-clamp-1">
                              {jt.description}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2 align-top text-[11px] text-[#9a9892]">
                          {jt.category || "\u2014"}
                        </td>
                        <td className="px-2 py-2 align-top text-right text-[11px] text-[#424143]">
                          {jt.estimatedHours ?? jt.tokenCost}{" "}
                          <span className="text-[10px] text-[#9a9892]">
                            hrs
                          </span>
                        </td>
                        <td className="px-2 py-2 align-top text-center text-[11px]">
                          {jt.hasQuantity ? (
                            <Badge variant="info">Yes</Badge>
                          ) : (
                            <span className="text-[#9a9892]">&mdash;</span>
                          )}
                        </td>
                        <td className="px-2 py-2 align-top text-center text-[11px]">
                          <Badge variant={jt.isActive ? "success" : "neutral"}>
                            {jt.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right: form */}
          <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
            <h2 className="text-sm font-semibold tracking-tight">
              {selected ? "Edit job type" : "Create new job type"}
            </h2>
            <p className="mt-1 text-xs text-[#7a7a7a]">
              Enter estimated hours. Token cost and designer payout are
              calculated automatically (1 token = 1 hour, 60% base payout).
            </p>

            {saveError && (
              <InlineAlert variant="error" size="sm" className="mt-3">
                {saveError}
              </InlineAlert>
            )}

            {saveSuccess && (
              <InlineAlert variant="success" size="sm" className="mt-3">
                {saveSuccess}
              </InlineAlert>
            )}

            <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="job-name"
                  className="text-xs font-medium text-[#424143]"
                >
                  Name
                </label>
                <FormInput
                  id="job-name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  placeholder="e.g. Logo design"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="job-category"
                  className="text-xs font-medium text-[#424143]"
                >
                  Category
                </label>
                <FormInput
                  id="job-category"
                  type="text"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  placeholder="e.g. Visual Design & Brand Identity"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="job-description"
                  className="text-xs font-medium text-[#424143]"
                >
                  Description
                </label>
                <FormTextarea
                  id="job-description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                  placeholder="Short description visible to team and admins."
                />
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="job-estimated-hours"
                  className="text-xs font-medium text-[#424143]"
                >
                  Estimated hours
                </label>
                <FormInput
                  id="job-estimated-hours"
                  type="number"
                  min={1}
                  value={formEstimatedHours}
                  onChange={(e) => setFormEstimatedHours(e.target.value)}
                  required
                  placeholder="e.g. 8"
                />
              </div>

              {/* Derived values preview */}
              {derivedTokenCost > 0 && (
                <div className="rounded-lg border border-[#e3e1dc] bg-[#faf9f7] px-3 py-2 text-xs text-[#7a7a7a]">
                  <p>
                    <span className="font-medium text-[#424143]">
                      Token cost:
                    </span>{" "}
                    {derivedTokenCost} tokens{" "}
                    <span className="text-[10px]">(1 token = 1 hour)</span>
                  </p>
                  <p className="mt-0.5">
                    <span className="font-medium text-[#424143]">
                      Designer payout:
                    </span>{" "}
                    {derivedDesignerPayout} tokens{" "}
                    <span className="text-[10px]">(60% base rate)</span>
                  </p>
                </div>
              )}

              {/* Has Quantity */}
              <label className="flex items-center gap-2 text-xs font-medium text-[#424143]">
                <input
                  type="checkbox"
                  checked={formHasQuantity}
                  onChange={(e) => setFormHasQuantity(e.target.checked)}
                  className="h-3 w-3 rounded border-[#d4d2cc] text-[#f15b2b] focus:ring-[#f15b2b]"
                />
                Has quantity (per-unit pricing)
              </label>

              {/* Quantity fields — visible when hasQuantity is checked */}
              {formHasQuantity && (
                <div className="grid gap-3 md:grid-cols-2 border-l-2 border-[#f15b2b]/20 pl-4">
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="job-quantity-label"
                      className="text-xs font-medium text-[#424143]"
                    >
                      Quantity label
                    </label>
                    <FormInput
                      id="job-quantity-label"
                      type="text"
                      value={formQuantityLabel}
                      onChange={(e) => setFormQuantityLabel(e.target.value)}
                      placeholder="e.g. Number of sizes"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="job-default-quantity"
                      className="text-xs font-medium text-[#424143]"
                    >
                      Default quantity
                    </label>
                    <FormInput
                      id="job-default-quantity"
                      type="number"
                      min={1}
                      value={formDefaultQuantity}
                      onChange={(e) => setFormDefaultQuantity(e.target.value)}
                      placeholder="1"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-medium text-[#424143]">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="h-3 w-3 rounded border-[#d4d2cc] text-[#f15b2b] focus:ring-[#f15b2b]"
                  />
                  Active
                </label>

                {selected && (
                  <Button variant="ghost" size="sm" onClick={resetForm}>
                    Clear selection
                  </Button>
                )}
              </div>

              <Button
                type="submit"
                loading={saving}
                loadingText="Saving\u2026"
                className="mt-2"
              >
                {selected ? "Save changes" : "Create job type"}
              </Button>
            </form>
          </div>
        </section>
    </>
  );
}
