// -----------------------------------------------------------------------------
// @file: app/admin/payout-rules/page.tsx
// @purpose: Admin-facing management of payout rules (gamification tiers)
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-25
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

type PayoutRule = {
  id: string;
  name: string;
  description: string | null;
  minCompletedTickets: number;
  timeWindowDays: number;
  payoutPercent: number;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type PayoutRulesResponse = {
  payoutRules: PayoutRule[];
  basePayoutPercent: number;
};

function formatTimeWindow(days: number): string {
  if (days % 365 === 0) return `${days / 365} year${days / 365 > 1 ? "s" : ""}`;
  if (days % 30 === 0) return `${days / 30} month${days / 30 > 1 ? "s" : ""}`;
  return `${days} day${days > 1 ? "s" : ""}`;
}

export default function AdminPayoutRulesPage() {
  const { showToast } = useToast();
  const [data, setData] = useState<PayoutRulesResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [filterActive, setFilterActive] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  const [selected, setSelected] = useState<PayoutRule | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formMinTickets, setFormMinTickets] = useState("");
  const [formTimeWindowDays, setFormTimeWindowDays] = useState("");
  const [formPayoutPercent, setFormPayoutPercent] = useState("");
  const [formPriority, setFormPriority] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const rules = data?.payoutRules ?? [];
  const basePayout = data?.basePayoutPercent ?? 60;

  const filteredRules = useMemo(() => {
    return rules.filter((r) => {
      if (filterActive === "ACTIVE") return r.isActive;
      if (filterActive === "INACTIVE") return !r.isActive;
      return true;
    });
  }, [rules, filterActive]);

  const activeCount = rules.filter((r) => r.isActive).length;
  const highestActive = rules
    .filter((r) => r.isActive)
    .reduce((max, r) => Math.max(max, r.payoutPercent), 0);

  const resetForm = () => {
    setSelected(null);
    setFormName("");
    setFormDescription("");
    setFormMinTickets("");
    setFormTimeWindowDays("");
    setFormPayoutPercent("");
    setFormPriority("");
    setFormIsActive(true);
    setSaveError(null);
    setSaveSuccess(null);
  };

  const fillFormFromSelection = (r: PayoutRule) => {
    setSelected(r);
    setFormName(r.name);
    setFormDescription(r.description ?? "");
    setFormMinTickets(String(r.minCompletedTickets));
    setFormTimeWindowDays(String(r.timeWindowDays));
    setFormPayoutPercent(String(r.payoutPercent));
    setFormPriority(String(r.priority));
    setFormIsActive(r.isActive);
    setSaveError(null);
    setSaveSuccess(null);
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/payout-rules", { cache: "no-store" });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) throw new Error("You must be signed in as an admin to view this page.");
        if (res.status === 403) throw new Error("You do not have permission to manage payout rules.");
        throw new Error(json?.error || `Request failed with status ${res.status}`);
      }

      setData(json as PayoutRulesResponse);
    } catch (err: any) {
      console.error("Admin payout rules fetch error:", err);
      setError(err?.message || "Failed to load payout rules.");
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
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEditClick = (r: PayoutRule) => {
    fillFormFromSelection(r);
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
        minCompletedTickets: parseInt(formMinTickets, 10),
        timeWindowDays: parseInt(formTimeWindowDays, 10),
        payoutPercent: parseInt(formPayoutPercent, 10),
        priority: formPriority ? parseInt(formPriority, 10) : 0,
        isActive: formIsActive,
      };

      const isEditing = !!selected;

      const res = await fetch("/api/admin/payout-rules", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEditing ? { id: selected?.id, ...payload } : payload),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || `Request failed with status ${res.status}`);
      }

      const msg = isEditing ? "Payout rule updated successfully." : "Payout rule created successfully.";
      setSaveSuccess(msg);
      showToast({ type: "success", title: msg });

      await load();

      if (!isEditing) resetForm();
    } catch (err: any) {
      console.error("Admin payout rules save error:", err);
      const errMsg = err?.message || "Failed to save payout rule.";
      setSaveError(errMsg);
      showToast({ type: "error", title: errMsg });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setDeleting(true);
    setSaveError(null);

    try {
      const res = await fetch(`/api/admin/payout-rules?id=${selected.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || `Delete failed with status ${res.status}`);
      }

      showToast({ type: "success", title: "Payout rule deleted." });
      resetForm();
      await load();
    } catch (err: any) {
      const errMsg = err?.message || "Failed to delete payout rule.";
      setSaveError(errMsg);
      showToast({ type: "error", title: errMsg });
    } finally {
      setDeleting(false);
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
          <h1 className="text-2xl font-semibold tracking-tight">Payout rules</h1>
          <p className="mt-1 text-sm text-[#7a7a7a]">
            Configure milestone-based payout bonuses for creatives. Base rate is{" "}
            <span className="font-semibold text-[#424143]">{basePayout}%</span>.
          </p>
        </div>
        <Button onClick={handleNewClick}>New rule</Button>
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
            Total rules
          </p>
          <p className="mt-2 text-3xl font-semibold text-[#424143]">
            {loading ? "\u2014" : rules.length}
          </p>
          <p className="mt-1 text-xs text-[#9a9892]">All configured payout rules.</p>
        </div>
        <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#9a9892]">
            Active rules
          </p>
          <p className="mt-2 text-2xl font-semibold text-[#424143]">
            {loading ? "\u2014" : activeCount}
          </p>
          <p className="mt-1 text-xs text-[#9a9892]">Rules being evaluated for creatives.</p>
        </div>
        <div className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#9a9892]">
            Highest active payout
          </p>
          <p className="mt-2 text-2xl font-semibold text-[#424143]">
            {loading ? "\u2014" : highestActive > 0 ? `${highestActive}%` : `${basePayout}%`}
          </p>
          <p className="mt-1 text-xs text-[#9a9892]">
            {highestActive > 0 ? "Top tier payout rate." : "Only base rate active."}
          </p>
        </div>
      </section>

      {/* Filter + table + form layout */}
      <section className="grid gap-4 md:grid-cols-[3fr_2fr]">
        {/* Left: table */}
        <div className="rounded-2xl border border-[#e3e1dc] bg-white px-4 py-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight">Rule list</h2>
              <FormSelect
                value={filterActive}
                onChange={(e) => setFilterActive(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")}
                size="sm"
                className="w-auto"
              >
                <option value="ALL">All</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </FormSelect>
            </div>
            <p className="text-xs text-[#9a9892]">
              Showing {filteredRules.length} of {rules.length}
            </p>
          </div>

          {loading ? (
            <LoadingState message="Loading payout rules\u2026" />
          ) : filteredRules.length === 0 ? (
            <EmptyState title="No payout rules match your filter." />
          ) : (
            <div className="max-h-[420px] overflow-y-auto overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#e3e1dc] text-xs uppercase tracking-[0.08em] text-[#9a9892]">
                    <th className="px-2 py-2">Name</th>
                    <th className="px-2 py-2 text-right">Min tickets</th>
                    <th className="px-2 py-2 text-right">Window</th>
                    <th className="px-2 py-2 text-right">Payout %</th>
                    <th className="px-2 py-2 text-center">Status</th>
                    <th className="px-2 py-2 text-right">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRules.map((r) => (
                    <tr
                      key={r.id}
                      className={`border-b border-[#f0eeea] text-xs last:border-b-0 ${
                        selected?.id === r.id ? "bg-[#fff5ef]" : "bg-white"
                      } cursor-pointer`}
                      onClick={() => handleEditClick(r)}
                    >
                      <td className="px-2 py-2 align-top text-[11px] text-[#424143]">
                        <div className="font-semibold">{r.name}</div>
                        {r.description && (
                          <div className="mt-0.5 text-[10px] text-[#7a7a7a]">
                            {r.description}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2 align-top text-right text-[11px] text-[#424143]">
                        {r.minCompletedTickets}
                      </td>
                      <td className="px-2 py-2 align-top text-right text-[11px] text-[#424143]">
                        {formatTimeWindow(r.timeWindowDays)}
                      </td>
                      <td className="px-2 py-2 align-top text-right text-[11px] font-semibold text-[#424143]">
                        {r.payoutPercent}%
                      </td>
                      <td className="px-2 py-2 align-top text-center text-[11px]">
                        <Badge variant={r.isActive ? "success" : "neutral"}>
                          {r.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-2 py-2 align-top text-right text-[11px] text-[#9a9892]">
                        {formatDate(r.updatedAt)}
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
            {selected ? "Edit payout rule" : "Create new payout rule"}
          </h2>
          <p className="mt-1 text-xs text-[#7a7a7a]">
            Creatives who meet the threshold earn the bonus payout rate. The highest
            qualifying rate is always applied.
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
              <label htmlFor="rule-name" className="text-xs font-medium text-[#424143]">
                Name
              </label>
              <FormInput
                id="rule-name"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                placeholder='e.g. "Gold Tier"'
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="rule-description" className="text-xs font-medium text-[#424143]">
                Description
              </label>
              <FormTextarea
                id="rule-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
                placeholder="Optional description shown to creatives."
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="rule-min-tickets" className="text-xs font-medium text-[#424143]">
                  Min completed tickets
                </label>
                <FormInput
                  id="rule-min-tickets"
                  type="number"
                  min={1}
                  value={formMinTickets}
                  onChange={(e) => setFormMinTickets(e.target.value)}
                  required
                  placeholder="e.g. 100"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="rule-window" className="text-xs font-medium text-[#424143]">
                  Time window (days)
                </label>
                <FormInput
                  id="rule-window"
                  type="number"
                  min={1}
                  value={formTimeWindowDays}
                  onChange={(e) => setFormTimeWindowDays(e.target.value)}
                  required
                  placeholder="e.g. 180"
                />
                <p className="text-[10px] text-[#9a9892]">
                  90 = 3 months, 180 = 6 months, 365 = 1 year
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="rule-payout" className="text-xs font-medium text-[#424143]">
                  Payout percentage
                </label>
                <FormInput
                  id="rule-payout"
                  type="number"
                  min={basePayout + 1}
                  max={100}
                  value={formPayoutPercent}
                  onChange={(e) => setFormPayoutPercent(e.target.value)}
                  required
                  placeholder="e.g. 70"
                />
                <p className="text-[10px] text-[#9a9892]">
                  Must be above base rate ({basePayout}%)
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="rule-priority" className="text-xs font-medium text-[#424143]">
                  Priority
                </label>
                <FormInput
                  id="rule-priority"
                  type="number"
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value)}
                  placeholder="0"
                />
                <p className="text-[10px] text-[#9a9892]">
                  Display ordering (optional)
                </p>
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

            <div className="flex items-center gap-2 pt-1">
              <Button type="submit" loading={saving} loadingText="Saving\u2026">
                {selected ? "Save changes" : "Create rule"}
              </Button>

              {selected && (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  loading={deleting}
                  loadingText="Deleting\u2026"
                  onClick={handleDelete}
                >
                  Delete
                </Button>
              )}
            </div>
          </form>
        </div>
      </section>
    </>
  );
}
