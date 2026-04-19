// -----------------------------------------------------------------------------
// @file: app/admin/companies/page.tsx
// @purpose: Admin-facing companies overview (tokens, plan & basic counts)
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-15
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable, THead, TH, TD } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FormInput, FormSelect, FormTextarea } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { Modal, ModalFooter, ModalHeader } from "@/components/ui/modal";

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

  const [planFilter, setPlanFilter] = useState<"ALL" | "WITH_PLAN" | "WITHOUT_PLAN">("ALL");

  // Token-adjustment modal state
  const [adjustTarget, setAdjustTarget] = useState<AdminCompany | null>(null);
  const [adjustDirection, setAdjustDirection] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [adjustAmount, setAdjustAmount] = useState<string>("");
  const [adjustNotes, setAdjustNotes] = useState<string>("");
  const [adjustSaving, setAdjustSaving] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/companies", {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("You must be signed in as an admin to view this page.");
        }
        if (res.status === 403) {
          throw new Error("You do not have permission to view companies overview.");
        }
        const msg = json?.error || `Request failed with status ${res.status}`;
        throw new Error(msg);
      }

      setData(json as AdminCompaniesResponse);
    } catch (err: any) {
      console.error("Admin companies fetch error:", err);
      setError(err?.message || "Failed to load companies overview.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openAdjust = (c: AdminCompany) => {
    setAdjustTarget(c);
    setAdjustDirection("CREDIT");
    setAdjustAmount("");
    setAdjustNotes("");
    setAdjustError(null);
  };

  const closeAdjust = () => {
    setAdjustTarget(null);
    setAdjustError(null);
  };

  const submitAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget) return;
    const amount = Number(adjustAmount);
    if (!Number.isInteger(amount) || amount < 1) {
      setAdjustError("Amount must be a positive integer.");
      return;
    }
    if (adjustNotes.trim().length < 3) {
      setAdjustError("Add a short note (≥ 3 characters) for the audit trail.");
      return;
    }
    setAdjustSaving(true);
    setAdjustError(null);
    try {
      const res = await fetch(`/api/admin/companies/${adjustTarget.id}/tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction: adjustDirection,
          amount,
          notes: adjustNotes.trim(),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error((json && json.error) || "Adjustment failed");
      closeAdjust();
      await load();
    } catch (err: any) {
      console.error("Adjust tokens error:", err);
      setAdjustError(err?.message || "Failed to adjust tokens.");
    } finally {
      setAdjustSaving(false);
    }
  };

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

  const totalProjects = companies.reduce((sum, c) => sum + c.counts.projects, 0);
  const totalTickets = companies.reduce((sum, c) => sum + c.counts.tickets, 0);

  return (
    <>
      {/* Page header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Companies overview</h1>
          <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
            All companies using Brandbite, with token balance and high-level activity metrics.
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
          <p className="text-xs font-medium tracking-[0.12em] text-[var(--bb-text-tertiary)] uppercase">
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
          <p className="text-xs font-medium tracking-[0.12em] text-[var(--bb-text-tertiary)] uppercase">
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
          <p className="text-xs font-medium tracking-[0.12em] text-[var(--bb-text-tertiary)] uppercase">
            Average balance
          </p>
          <p className="mt-2 text-2xl font-semibold text-[var(--bb-secondary)]">
            {loading ? "—" : stats ? Math.round(stats.avgTokenBalance) : 0}
          </p>
          <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">Average tokens per company.</p>
        </div>

        <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-4 shadow-sm">
          <p className="text-xs font-medium tracking-[0.12em] text-[var(--bb-text-tertiary)] uppercase">
            Projects & tickets
          </p>
          <p className="mt-2 text-2xl font-semibold text-[var(--bb-secondary)]">
            {loading ? "—" : totalProjects}
            <span className="ml-1 text-xs font-normal text-[var(--bb-text-secondary)]">
              projects
            </span>
          </p>
          <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
            {loading ? "" : `${totalTickets} tickets across all companies.`}
          </p>
        </div>
      </section>

      {/* Filter + table */}
      <section className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-4 py-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight">Company list</h2>
            <FormSelect
              size="sm"
              className="w-auto"
              value={planFilter}
              onChange={(e) =>
                setPlanFilter(e.target.value as "ALL" | "WITH_PLAN" | "WITHOUT_PLAN")
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
              <TH align="right">Actions</TH>
            </THead>
            <tbody>
              {filteredCompanies.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-[var(--bb-border-subtle)] last:border-b-0"
                >
                  <TD>
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-[10px] text-[var(--bb-text-tertiary)]">{c.slug}</div>
                  </TD>
                  <TD>
                    {c.plan ? (
                      <>
                        <div className="font-medium">{c.plan.name}</div>
                        <div className="text-[10px] text-[var(--bb-text-tertiary)]">
                          {c.plan.monthlyTokens} tokens / month
                        </div>
                      </>
                    ) : (
                      <span className="text-[11px] text-[var(--bb-text-tertiary)]">No plan</span>
                    )}
                  </TD>
                  <TD align="right">{c.tokenBalance}</TD>
                  <TD align="right">{c.counts.members}</TD>
                  <TD align="right">{c.counts.projects}</TD>
                  <TD align="right">{c.counts.tickets}</TD>
                  <TD align="right" className="text-[var(--bb-text-tertiary)]">
                    {formatDate(c.createdAt)}
                  </TD>
                  <TD align="right">
                    <button
                      type="button"
                      onClick={() => openAdjust(c)}
                      className="rounded-full border border-[var(--bb-border)] bg-white px-2 py-0.5 text-[11px] font-medium text-[var(--bb-primary)] hover:border-[var(--bb-primary)]"
                    >
                      Adjust tokens
                    </button>
                  </TD>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </section>

      {/* Token-adjustment modal */}
      <Modal open={adjustTarget !== null} onClose={closeAdjust} size="md">
        <ModalHeader
          eyebrow="Admin adjustment"
          title={adjustTarget ? `Adjust tokens — ${adjustTarget.name}` : "Adjust tokens"}
          subtitle={
            adjustTarget
              ? `Current balance: ${adjustTarget.tokenBalance} tokens. This writes a ledger entry with reason ADMIN_ADJUSTMENT.`
              : undefined
          }
          onClose={closeAdjust}
        />

        <form onSubmit={submitAdjust} className="space-y-4">
          <div>
            <label className="mb-1 block text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
              Action
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAdjustDirection("CREDIT")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  adjustDirection === "CREDIT"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                    : "border-[var(--bb-border)] text-[var(--bb-text-secondary)] hover:border-emerald-300"
                }`}
              >
                + Grant tokens
              </button>
              <button
                type="button"
                onClick={() => setAdjustDirection("DEBIT")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  adjustDirection === "DEBIT"
                    ? "border-rose-500 bg-rose-50 text-rose-900"
                    : "border-[var(--bb-border)] text-[var(--bb-text-secondary)] hover:border-rose-300"
                }`}
              >
                − Revoke tokens
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
              Amount
            </label>
            <FormInput
              type="number"
              min={1}
              step={1}
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              placeholder="e.g. 500"
              autoFocus
            />
            {adjustDirection === "DEBIT" && adjustTarget && (
              <p className="mt-1 text-[11px] text-[var(--bb-text-muted)]">
                Max revoke: {adjustTarget.tokenBalance} (can&apos;t go below zero).
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold tracking-[0.15em] text-[var(--bb-text-tertiary)] uppercase">
              Reason / notes (required)
            </label>
            <FormTextarea
              rows={3}
              value={adjustNotes}
              onChange={(e) => setAdjustNotes(e.target.value)}
              placeholder="e.g. Compensation for platform outage 2026-04-18"
              maxLength={500}
            />
            <p className="mt-1 text-[11px] text-[var(--bb-text-muted)]">
              Shown on the token ledger for audit.
            </p>
          </div>

          {adjustError && <InlineAlert variant="error">{adjustError}</InlineAlert>}

          <ModalFooter>
            <Button variant="ghost" type="button" onClick={closeAdjust} disabled={adjustSaving}>
              Cancel
            </Button>
            <Button type="submit" loading={adjustSaving} loadingText="Saving...">
              {adjustDirection === "CREDIT" ? "Grant" : "Revoke"} {adjustAmount ? adjustAmount : ""}{" "}
              tokens
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </>
  );
}
