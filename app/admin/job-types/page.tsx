// -----------------------------------------------------------------------------
// @file: app/admin/job-types/page.tsx
// @purpose: Admin-facing management of job types (token cost & designer payout)
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-15
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
  description: string | null;
  tokenCost: number;
  designerPayoutTokens: number;
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
  const [formDescription, setFormDescription] = useState("");
  const [formTokenCost, setFormTokenCost] = useState("");
  const [formDesignerPayout, setFormDesignerPayout] = useState("");
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

  const resetForm = () => {
    setSelected(null);
    setFormName("");
    setFormDescription("");
    setFormTokenCost("");
    setFormDesignerPayout("");
    setFormIsActive(true);
    setSaveError(null);
    setSaveSuccess(null);
  };

  const fillFormFromSelection = (jt: JobType) => {
    setSelected(jt);
    setFormName(jt.name);
    setFormDescription(jt.description ?? "");
    setFormTokenCost(String(jt.tokenCost));
    setFormDesignerPayout(String(jt.designerPayoutTokens));
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
      const payload = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        tokenCost: parseInt(formTokenCost, 10),
        designerPayoutTokens: parseInt(formDesignerPayout, 10),
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
              Configure token cost and designer payout for each job type.
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
              {loading ? "—" : jobTypes.length}
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
              {loading ? "—" : activeCount}
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
              {loading ? "—" : inactiveCount}
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
              <LoadingState message="Loading job types…" />
            ) : filteredJobTypes.length === 0 ? (
              <EmptyState title="No job types match your filter." />
            ) : (
              <div className="max-h-[420px] overflow-y-auto overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#e3e1dc] text-xs uppercase tracking-[0.08em] text-[#9a9892]">
                      <th className="px-2 py-2">Name</th>
                      <th className="px-2 py-2 text-right">Cost</th>
                      <th className="px-2 py-2 text-right">Payout</th>
                      <th className="px-2 py-2 text-center">Status</th>
                      <th className="px-2 py-2 text-right">Updated</th>
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
                            <div className="mt-0.5 text-[10px] text-[#7a7a7a]">
                              {jt.description}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2 align-top text-right text-[11px] text-[#424143]">
                          {jt.tokenCost}{" "}
                          <span className="text-[10px] text-[#9a9892]">
                            tokens
                          </span>
                        </td>
                        <td className="px-2 py-2 align-top text-right text-[11px] text-[#424143]">
                          {jt.designerPayoutTokens}{" "}
                          <span className="text-[10px] text-[#9a9892]">
                            tokens
                          </span>
                        </td>
                        <td className="px-2 py-2 align-top text-center text-[11px]">
                          <Badge variant={jt.isActive ? "success" : "neutral"}>
                            {jt.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-2 py-2 align-top text-right text-[11px] text-[#9a9892]">
                          {formatDate(jt.updatedAt)}
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
              Token cost is what the customer pays. Designer payout is
              what the designer earns when the job is completed.
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
                  htmlFor="job-description"
                  className="text-xs font-medium text-[#424143]"
                >
                  Description
                </label>
                <FormTextarea
                  id="job-description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={3}
                  placeholder="Short description visible to team and admins."
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="job-token-cost"
                    className="text-xs font-medium text-[#424143]"
                  >
                    Token cost (customer)
                  </label>
                  <FormInput
                    id="job-token-cost"
                    type="number"
                    min={1}
                    value={formTokenCost}
                    onChange={(e) => setFormTokenCost(e.target.value)}
                    required
                    placeholder="e.g. 8"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="job-designer-payout"
                    className="text-xs font-medium text-[#424143]"
                  >
                    Designer payout (tokens)
                  </label>
                  <FormInput
                    id="job-designer-payout"
                    type="number"
                    min={0}
                    value={formDesignerPayout}
                    onChange={(e) => setFormDesignerPayout(e.target.value)}
                    required
                    placeholder="e.g. 5"
                  />
                </div>
              </div>

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
                loadingText="Saving…"
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
