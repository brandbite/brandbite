// -----------------------------------------------------------------------------
// @file: app/admin/plan-assignment/page.tsx
// @purpose: Admin-facing UI to assign subscription plans to companies.
//           Companies list on the left; the panel on the right previews the
//           plan change (current → new, balance unchanged) and only applies
//           it when the admin presses "Apply plan change".
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-11-01
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Callout,
  Card,
  DASH,
  DetailPanel,
  EmptyState,
  Field,
  FilterBar,
  IconTile,
  PageHeader,
  PanelSection,
  SaveBar,
  SearchInput,
  Select,
  Skeleton,
  SplitView,
  Table,
  TableFooter,
  Td,
  TextLink,
  Th,
  Tr,
  fmt,
  plural,
} from "@/components/admin/v2/ui";
import { IconAlertCircle, IconBuilding, IconDocument } from "@/components/admin/v2/icons";
import { useUnsavedChanges } from "@/components/admin/v2/unsaved-changes";

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
  isRecurring?: boolean;
  attachedCompanies: number;
  createdAt: string;
  updatedAt: string;
};

type PlansResponse = {
  plans: Plan[];
};

/** Draft plan per company: plan id, or "" for "no plan". */
type Drafts = Record<string, string>;

const formatPrice = (priceCents: number | null) => {
  if (priceCents == null) return DASH;
  const dollars = priceCents / 100;
  return `$${dollars.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
};

function IconChevronRight() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export default function AdminPlanAssignmentPage() {
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [savingCompanyId, setSavingCompanyId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Unapplied plan changes. Nothing is sent until "Apply plan change".
  const [drafts, setDrafts] = useState<Drafts>({});

  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState("ALL");

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
            throw new Error("You must be signed in as an admin to view this page.");
          }
          if (companiesRes.status === 403) {
            throw new Error("You do not have permission to view companies.");
          }
          const msg =
            companiesJson?.error || `Companies request failed with status ${companiesRes.status}`;
          throw new Error(msg);
        }

        if (!plansRes.ok) {
          if (plansRes.status === 401) {
            throw new Error("You must be signed in as an admin to view plans.");
          }
          if (plansRes.status === 403) {
            throw new Error("You do not have permission to view plans.");
          }
          const msg = plansJson?.error || `Plans request failed with status ${plansRes.status}`;
          throw new Error(msg);
        }

        if (!cancelled) {
          setCompanies((companiesJson as AdminCompaniesResponse).companies ?? []);
          setPlans((plansJson as PlansResponse).plans ?? []);
        }
      } catch (err: any) {
        console.error("Admin plan assignment fetch error:", err);
        if (!cancelled) {
          setError(err?.message || "Failed to load companies or plans.");
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

  const activePlans = useMemo(() => plans.filter((p) => p.isActive), [plans]);
  const planById = useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans]);

  const loaded = !loading || companies.length > 0;
  const unassignedCount = companies.filter((c) => !c.plan).length;

  /** Draft for a company, only when it differs from the applied plan. */
  const pendingFor = (c: AdminCompany): string | undefined => {
    const d = drafts[c.id];
    if (d === undefined) return undefined;
    return d === (c.plan?.id ?? "") ? undefined : d;
  };
  const pendingCompanies = companies.filter((c) => pendingFor(c) !== undefined);
  // Drafts are kept per company, so switching rows never drops them — only
  // leaving the page does.
  useUnsavedChanges(pendingCompanies.length > 0, "Plan assignments");

  const filteredCompanies = useMemo(() => {
    const q = query.trim().toLowerCase();
    return companies.filter((c) => {
      if (planFilter === "NONE" && c.plan) return false;
      if (planFilter.startsWith("plan:") && c.plan?.id !== planFilter.slice(5)) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q);
    });
  }, [companies, query, planFilter]);

  const filtersActive = query.trim() !== "" || planFilter !== "ALL";
  const resetFilters = () => {
    setQuery("");
    setPlanFilter("ALL");
  };

  const selected = companies.find((c) => c.id === selectedId) ?? null;

  const planLabel = (id: string) => (id === "" ? "No plan" : (planById.get(id)?.name ?? DASH));

  const handleChangePlan = async (companyId: string, newPlanId: string) => {
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
        const msg = json?.error || `Request failed with status ${res.status}`;
        throw new Error(msg);
      }

      const updated = json?.company as AdminCompany | undefined;
      if (updated) {
        setCompanies((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      }
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[companyId];
        return next;
      });

      setSaveMessage("Plan updated successfully.");
    } catch (err: any) {
      console.error("Plan assignment save error:", err);
      setSaveError(err?.message || "Failed to update plan.");
    } finally {
      setSavingCompanyId(null);
    }
  };

  const setDraft = (companyId: string, planId: string) =>
    setDrafts((prev) => ({ ...prev, [companyId]: planId }));

  const discardDraft = (companyId: string) =>
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[companyId];
      return next;
    });

  // ---------------------------------------------------------------------------
  // Panel
  // ---------------------------------------------------------------------------

  const planSummary = (plan: CompanyPlan | Plan | null) =>
    plan ? (
      <>
        <p className="font-semibold">
          {plan.name}
          <span className="font-normal text-[var(--av2-text-2)] tabular-nums">
            {" "}
            · {fmt(plan.monthlyTokens)} tokens / month
          </span>
        </p>
        <p className="mt-0.5 text-sm text-[var(--av2-text-2)] tabular-nums">
          {formatPrice(plan.priceCents)}
          {plan.priceCents != null &&
            (planById.get(plan.id)?.isRecurring === false ? " one-time" : " / month")}
          {!plan.isActive && " · plan inactive"}
        </p>
      </>
    ) : (
      <p className="font-semibold">No plan assigned</p>
    );

  let panel = null;
  if (selected) {
    const pending = pendingFor(selected);
    const draftValue = drafts[selected.id] ?? selected.plan?.id ?? "";
    const newPlan =
      pending !== undefined && pending !== "" ? (planById.get(pending) ?? null) : null;
    const isSaving = savingCompanyId === selected.id;
    const currentInactive = selected.plan && !selected.plan.isActive;

    panel = (
      <DetailPanel
        title={
          <span className="flex flex-wrap items-center gap-3">
            Change plan
            {pending !== undefined && <Badge tone="lavender">Preview · not applied</Badge>}
          </span>
        }
        onClose={() => setSelectedId(null)}
        closeLabel="Close plan change"
        footer={
          <SaveBar
            dirty={pending !== undefined}
            status={
              isSaving
                ? "Applying…"
                : pending !== undefined
                  ? `Unsaved: ${selected.name} ${planLabel(selected.plan?.id ?? "")} → ${planLabel(pending)}`
                  : "No unsaved changes"
            }
          >
            {pending !== undefined && (
              <Button variant="ghost" disabled={isSaving} onClick={() => discardDraft(selected.id)}>
                Cancel
              </Button>
            )}
            <Button
              variant="primary"
              disabled={pending === undefined || isSaving}
              onClick={() => pending !== undefined && handleChangePlan(selected.id, pending)}
            >
              {isSaving ? "Applying…" : "Apply plan change"}
            </Button>
          </SaveBar>
        }
      >
        <div className="flex items-center gap-4">
          <IconTile tone="lavender" size={48}>
            <IconBuilding />
          </IconTile>
          <div className="min-w-0">
            <p className="truncate text-lg leading-7 font-semibold">{selected.name}</p>
            <p className="truncate text-sm text-[var(--av2-text-2)]">{selected.slug}</p>
          </div>
        </div>

        <div className="mt-6">
          <PanelSection>
            <p className="mb-1.5 text-sm font-medium">Current plan</p>
            <div className="rounded-lg border border-[var(--av2-border)] bg-[var(--av2-bg)] px-4 py-3 text-sm">
              {planSummary(selected.plan)}
            </div>

            <Field
              className="mt-5"
              label="New plan (to assign)"
              htmlFor="plan-assign-select"
              hint={
                activePlans.length === 0
                  ? "No active plans available. Activate a plan first."
                  : "Only active plans can be assigned."
              }
            >
              <Select
                id="plan-assign-select"
                disabled={isSaving || activePlans.length === 0}
                value={draftValue}
                onChange={(e) => setDraft(selected.id, e.target.value)}
              >
                <option value="">No plan assigned</option>
                {currentInactive && selected.plan && (
                  <option value={selected.plan.id} disabled>
                    {selected.plan.name} (current, inactive)
                  </option>
                )}
                {activePlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({fmt(p.monthlyTokens)} tokens)
                  </option>
                ))}
              </Select>
            </Field>

            {pending !== undefined && (
              <div className="mt-5 flex items-center gap-3 rounded-lg border border-[var(--av2-border)] px-4 py-3 text-sm">
                <span className="min-w-0 flex-1 truncate text-[var(--av2-text-2)]">
                  {planLabel(selected.plan?.id ?? "")}
                </span>
                <span className="shrink-0 text-[var(--av2-text-2)]">
                  <IconArrowRight />
                </span>
                <span className="min-w-0 flex-1 truncate text-right font-semibold">
                  {planLabel(pending)}
                  {newPlan && (
                    <span className="block text-xs font-normal text-[var(--av2-text-2)] tabular-nums">
                      {fmt(newPlan.monthlyTokens)} tokens / month
                    </span>
                  )}
                </span>
              </div>
            )}
          </PanelSection>

          <PanelSection>
            {/* PATCH /api/admin/plan-assignment only writes company.planId;
                tokenBalance is never touched by this endpoint. */}
            <div className="rounded-xl border border-[var(--av2-attention-border)] bg-[var(--av2-attention-from)] p-4">
              <div className="flex items-start gap-3">
                <IconAlertCircle className="mt-0.5 shrink-0 text-[var(--av2-link)]" />
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">Existing balance stays unchanged</p>
                  <p className="mt-0.5 text-[var(--av2-text-2)]">
                    Assigning a plan only updates the company&apos;s plan link. It does not add or
                    remove tokens.
                  </p>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-2 divide-x divide-[var(--av2-border)] rounded-lg bg-[var(--av2-surface)] py-3">
                <div className="px-4">
                  <dt className="text-xs text-[var(--av2-text-2)]">Current balance</dt>
                  <dd className="mt-0.5 text-xl font-bold tabular-nums">
                    {fmt(selected.tokenBalance)}{" "}
                    <span className="text-sm font-medium">
                      {plural(selected.tokenBalance, "token", "tokens")}
                    </span>
                  </dd>
                </div>
                <div className="px-4">
                  <dt className="text-xs text-[var(--av2-text-2)]">After assignment</dt>
                  <dd className="mt-0.5 text-xl font-bold tabular-nums">
                    {fmt(selected.tokenBalance)}{" "}
                    <span className="text-sm font-medium">
                      {plural(selected.tokenBalance, "token", "tokens")}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
          </PanelSection>

          <PanelSection>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="text-[var(--av2-text-2)]">
                Created {formatDate(selected.createdAt)}
              </span>
              <TextLink href="/admin/plans">Manage plans</TextLink>
            </div>
          </PanelSection>
        </div>
      </DetailPanel>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const planFilterOptions = useMemo(() => {
    const m = new Map<string, string>();
    plans.forEach((p) => m.set(p.id, p.name));
    companies.forEach((c) => c.plan && m.set(c.plan.id, c.plan.name));
    return [...m.entries()];
  }, [plans, companies]);

  return (
    <>
      <PageHeader
        title="Plan assignment"
        description="Link companies to subscription plans. Changes are previewed first; balances are never changed automatically."
        meta={
          loaded && !error ? (
            <span className="tabular-nums">
              {fmt(companies.length)} {plural(companies.length, "company", "companies")} ·{" "}
              {fmt(activePlans.length)} active {plural(activePlans.length, "plan", "plans")} ·{" "}
              {fmt(unassignedCount)} unassigned
            </span>
          ) : null
        }
      />

      {error && (
        <div className="mb-6">
          <Callout tone="error" title="Something went wrong">
            {error}
          </Callout>
        </div>
      )}

      {saveMessage && (
        <div className="mb-6">
          <Callout
            tone="success"
            title={saveMessage}
            action={
              <Button size="sm" variant="ghost" onClick={() => setSaveMessage(null)}>
                Dismiss
              </Button>
            }
          />
        </div>
      )}
      {saveError && (
        <div className="mb-6">
          <Callout tone="error" title="Couldn't update the plan">
            {saveError}
          </Callout>
        </div>
      )}

      <SplitView panel={panel}>
        <Card padding="none">
          <div className="px-6 pt-5">
            <FilterBar>
              <SearchInput
                className="min-w-[200px] flex-1"
                value={query}
                onChange={setQuery}
                placeholder="Search companies"
                label="Search companies by name or slug"
              />
              <div className="w-full sm:w-44">
                <Select
                  aria-label="Filter by current plan"
                  value={planFilter}
                  onChange={(e) => setPlanFilter(e.target.value)}
                >
                  <option value="ALL">All plans</option>
                  <option value="NONE">No plan</option>
                  {planFilterOptions.map(([id, name]) => (
                    <option key={id} value={`plan:${id}`}>
                      {name}
                    </option>
                  ))}
                </Select>
              </div>
            </FilterBar>
          </div>

          {loading && companies.length === 0 ? (
            <div className="space-y-3 border-t border-[var(--av2-border)] px-6 py-5" role="status">
              <span className="sr-only">Loading companies and plans…</span>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : companies.length === 0 ? (
            <div className="border-t border-[var(--av2-border)]">
              <EmptyState
                icon={<IconBuilding width={28} height={28} />}
                title="No companies found"
                description="Once companies are created, they will appear here for plan assignment."
              />
            </div>
          ) : filteredCompanies.length === 0 ? (
            <div className="border-t border-[var(--av2-border)]">
              <EmptyState
                title="No companies match these filters"
                description="Try a different search or plan."
                action={<Button onClick={resetFilters}>Clear filters</Button>}
              />
            </div>
          ) : (
            <Table label="Companies and plans">
              <thead>
                <tr>
                  <Th>Company</Th>
                  <Th>Current plan</Th>
                  <Th align="right">Balance</Th>
                  <Th align="right">Projects</Th>
                  <Th align="right">Tickets</Th>
                  <Th align="right">
                    <span className="sr-only">Open</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.map((c) => {
                  const pending = pendingFor(c);
                  return (
                    <Tr
                      key={c.id}
                      selected={c.id === selectedId}
                      onSelect={() => setSelectedId(c.id)}
                      label={`${c.name}, ${c.plan ? c.plan.name : "no plan"}`}
                    >
                      <Td>
                        <div className="flex items-center gap-3">
                          <IconTile tone="neutral" size={40}>
                            <IconBuilding width={20} height={20} />
                          </IconTile>
                          <div className="min-w-0">
                            <div className="font-semibold">{c.name}</div>
                            <div className="text-xs text-[var(--av2-text-2)]">{c.slug}</div>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        {c.plan ? (
                          <>
                            <div className="font-semibold">{c.plan.name}</div>
                            <div className="text-xs whitespace-nowrap text-[var(--av2-text-2)] tabular-nums">
                              {fmt(c.plan.monthlyTokens)} tokens / month
                              {!c.plan.isActive && " · inactive"}
                            </div>
                          </>
                        ) : (
                          <span className="text-[var(--av2-text-2)]">No plan</span>
                        )}
                        {pending !== undefined && (
                          <div className="mt-1">
                            <Badge tone="lavender">Pending → {planLabel(pending)}</Badge>
                          </div>
                        )}
                      </Td>
                      <Td align="right" className="whitespace-nowrap">
                        {fmt(c.tokenBalance)}
                        <span className="ml-1 text-xs text-[var(--av2-text-2)]">tokens</span>
                      </Td>
                      <Td align="right">{fmt(c.counts.projects)}</Td>
                      <Td align="right">{fmt(c.counts.tickets)}</Td>
                      <Td align="right" className="text-[var(--av2-text-2)]">
                        <span className="inline-flex">
                          <IconChevronRight />
                        </span>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          )}

          {companies.length > 0 && (
            <TableFooter>
              <span className="tabular-nums">
                Showing {fmt(filteredCompanies.length)} of {fmt(companies.length)}{" "}
                {plural(companies.length, "company", "companies")}
              </span>
              {pendingCompanies.length > 0 ? (
                <span className="font-medium text-[var(--av2-link)] tabular-nums">
                  {fmt(pendingCompanies.length)} pending{" "}
                  {plural(pendingCompanies.length, "change", "changes")} · not applied
                </span>
              ) : filtersActive ? (
                <Button size="sm" variant="ghost" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : null}
            </TableFooter>
          )}
        </Card>

        {!selected && companies.length > 0 && (
          <p className="mt-6 flex items-center gap-2 text-sm text-[var(--av2-text-2)]">
            <IconDocument width={18} height={18} className="shrink-0" />
            Select a company to preview and apply a plan change.
          </p>
        )}
      </SplitView>
    </>
  );
}
