// -----------------------------------------------------------------------------
// @file: app/admin/companies/page.tsx
// @purpose: Admin-facing companies overview (tokens, plan & basic counts).
//           List on the left, detail panel of the selected company on the
//           right. Token adjustments (L2 typed phrase + L4 MFA) and the
//           company-wide auto-assign default are driven from the panel.
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-11-01
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { MfaChallengeModal, type MfaChallengeInfo } from "@/components/admin/mfa-challenge-modal";
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
  KpiCard,
  PageHeader,
  PanelSection,
  SearchInput,
  Select,
  Skeleton,
  SplitView,
  StatusDot,
  Table,
  TableFooter,
  Td,
  TextArea,
  TextInput,
  TextLink,
  Th,
  Tr,
  fmt,
  plural,
} from "@/components/admin/v2/ui";
import {
  IconAlertCircle,
  IconBuilding,
  IconCoins,
  IconDocument,
} from "@/components/admin/v2/icons";

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
  /** Company-wide auto-assign default. Projects in INHERIT mode (the
   *  default) resolve against this when a new ticket picks a creative. */
  autoAssignDefaultEnabled: boolean;
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

/** Same threshold the dashboard's "Low-balance companies" signal uses. */
const LOW_BALANCE = 5;

type BalanceFilter = "ALL" | "LOW" | "OK";

const isLow = (c: AdminCompany) => c.tokenBalance < LOW_BALANCE;

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

function IconFolder() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  );
}

function LowBalanceNote() {
  return (
    <span className="mt-0.5 flex items-center gap-1 text-xs font-medium whitespace-nowrap text-[var(--av2-error-text)]">
      <IconAlertCircle width={14} height={14} className="shrink-0" />
      Low balance
    </span>
  );
}

export default function AdminCompaniesPage() {
  const [data, setData] = useState<AdminCompaniesResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // "ALL" | "WITH_PLAN" | "WITHOUT_PLAN" | "plan:<id>" (derived client-side)
  const [planFilter, setPlanFilter] = useState<string>("ALL");
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>("ALL");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Token-adjustment modal state
  const [adjustTarget, setAdjustTarget] = useState<AdminCompany | null>(null);
  const [adjustDirection, setAdjustDirection] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [adjustAmount, setAdjustAmount] = useState<string>("");
  const [adjustNotes, setAdjustNotes] = useState<string>("");
  // Typed-phrase confirmation (Security Plan — L2). Expected value is
  // "GRANT" for CREDIT and "DEBIT" for DEBIT; server enforces the match.
  const [adjustConfirmation, setAdjustConfirmation] = useState<string>("");
  const [adjustSaving, setAdjustSaving] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // L4 MFA state. Grant POST can return 202 requiresMfa; stash the
  // challenge + retry closure so the modal can drive the re-submit.
  const [pendingMfa, setPendingMfa] = useState<{
    challenge: MfaChallengeInfo;
    retry: () => Promise<void>;
  } | null>(null);

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

  // Auto-assign toggle. Per-company busy id so a slow PATCH only disables the
  // control it belongs to. Errors land in the page-level banner.
  const [autoAssignBusyId, setAutoAssignBusyId] = useState<string | null>(null);
  // Confirm dialog when ENABLING for a company that has an unassigned backlog.
  const [autoAssignConfirm, setAutoAssignConfirm] = useState<{
    company: AdminCompany;
    unassignedCount: number;
  } | null>(null);
  const [autoAssignNotice, setAutoAssignNotice] = useState<string | null>(null);

  const patchAutoAssign = async (c: AdminCompany, enabled: boolean, backfill: boolean) => {
    setAutoAssignBusyId(c.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/companies/${c.id}/auto-assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, backfill }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || `Request failed with status ${res.status}`);
      if (backfill && json?.backfill) {
        const b = json.backfill;
        setAutoAssignNotice(
          `Auto-assign enabled for ${c.name} — assigned ${b.assigned} of ${b.scanned} unassigned ticket(s)` +
            (b.skipped ? `, ${b.skipped} skipped (project off / no eligible creative)` : "") +
            (b.hasMore ? ". More remain — run again from the board." : "."),
        );
      }
      await load();
    } catch (err: any) {
      console.error("Auto-assign toggle error:", err);
      setError(err?.message || "Failed to update auto-assign setting.");
    } finally {
      setAutoAssignBusyId(null);
      setAutoAssignConfirm(null);
    }
  };

  const toggleAutoAssign = async (c: AdminCompany) => {
    // Turning OFF is immediate — disabling never assigns anything.
    if (c.autoAssignDefaultEnabled) {
      await patchAutoAssign(c, false, false);
      return;
    }
    // Turning ON — check for an existing unassigned backlog first, and only
    // prompt to sweep it when there's something to sweep.
    setAutoAssignBusyId(c.id);
    setError(null);
    setAutoAssignNotice(null);
    try {
      const res = await fetch(`/api/admin/companies/${c.id}/auto-assign`);
      const json = await res.json().catch(() => null);
      const count = typeof json?.unassignedCount === "number" ? json.unassignedCount : 0;
      if (count > 0) {
        setAutoAssignConfirm({ company: c, unassignedCount: count });
        setAutoAssignBusyId(null);
      } else {
        await patchAutoAssign(c, true, false);
      }
    } catch (err: any) {
      console.error("Auto-assign preview error:", err);
      setError(err?.message || "Failed to check auto-assign.");
      setAutoAssignBusyId(null);
    }
  };

  const openAdjust = (c: AdminCompany) => {
    setAdjustTarget(c);
    setAdjustDirection("CREDIT");
    setAdjustAmount("");
    setAdjustNotes("");
    setAdjustConfirmation("");
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
    const expectedPhrase = adjustDirection === "CREDIT" ? "GRANT" : "DEBIT";
    if (adjustConfirmation.trim().toUpperCase() !== expectedPhrase) {
      setAdjustError(`Type "${expectedPhrase}" to confirm this ${adjustDirection.toLowerCase()}.`);
      return;
    }
    setAdjustSaving(true);
    setAdjustError(null);
    const targetId = adjustTarget.id;
    const retryBody = {
      direction: adjustDirection,
      amount,
      notes: adjustNotes.trim(),
      confirmation: adjustConfirmation.trim(),
    };

    const postIt = async () => {
      const res = await fetch(`/api/admin/companies/${targetId}/tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(retryBody),
      });
      const json = await res.json().catch(() => null);

      // L4 — MFA challenge issued (method: "email" | "totp").
      if (res.status === 202 && json?.requiresMfa) {
        setPendingMfa({
          challenge: {
            method: json.method,
            challengeId: json.challengeId,
            maskedEmail: json.maskedEmail,
            expiresAt: json.expiresAt,
            actionTag: json.actionTag,
          },
          retry: postIt,
        });
        return;
      }

      if (!res.ok) throw new Error((json && json.error) || "Adjustment failed");
      closeAdjust();
      await load();
    };

    try {
      await postIt();
    } catch (err: any) {
      console.error("Adjust tokens error:", err);
      setAdjustError(err?.message || "Failed to adjust tokens.");
    } finally {
      setAdjustSaving(false);
    }
  };

  const companies = useMemo(() => data?.companies ?? [], [data]);
  const stats = data?.stats;

  // Distinct plans present in the list, for the plan filter.
  const planOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of companies) if (c.plan) m.set(c.plan.id, c.plan.name);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [companies]);

  const filteredCompanies = useMemo(() => {
    const q = query.trim().toLowerCase();
    return companies.filter((c) => {
      if (planFilter === "WITH_PLAN" && c.plan == null) return false;
      if (planFilter === "WITHOUT_PLAN" && c.plan != null) return false;
      if (planFilter.startsWith("plan:") && c.plan?.id !== planFilter.slice(5)) return false;
      if (balanceFilter === "LOW" && !isLow(c)) return false;
      if (balanceFilter === "OK" && isLow(c)) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.slug.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [companies, planFilter, balanceFilter, query]);

  const filtersActive = planFilter !== "ALL" || balanceFilter !== "ALL" || query.trim() !== "";
  const resetFilters = () => {
    setPlanFilter("ALL");
    setBalanceFilter("ALL");
    setQuery("");
  };

  const selected = companies.find((c) => c.id === selectedId) ?? null;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { dateStyle: "medium" });
  };

  const totalProjects = data ? companies.reduce((sum, c) => sum + c.counts.projects, 0) : null;
  const totalTickets = data ? companies.reduce((sum, c) => sum + c.counts.tickets, 0) : null;
  const lowCount = data ? companies.filter(isLow).length : null;

  // ---------------------------------------------------------------------------
  // Detail panel
  // ---------------------------------------------------------------------------

  const panel = selected ? (
    <DetailPanel
      title="Company details"
      onClose={() => setSelectedId(null)}
      closeLabel="Close company details"
    >
      <div className="flex items-center gap-4">
        <IconTile tone="lavender" size={56}>
          <span className="text-2xl font-bold" aria-hidden>
            {selected.name.trim().charAt(0).toUpperCase() || "?"}
          </span>
        </IconTile>
        <div className="min-w-0">
          <p className="truncate text-2xl leading-8 font-bold">{selected.name}</p>
          <p className="truncate text-sm text-[var(--av2-text-2)]">{selected.slug}</p>
        </div>
      </div>

      <div
        className={`mt-5 rounded-2xl border p-5 ${
          isLow(selected)
            ? "border-[var(--av2-attention-border)] bg-[var(--av2-selected)]"
            : "border-[var(--av2-border)] bg-[var(--av2-bg)]"
        }`}
      >
        <p className="text-sm font-medium">Available tokens</p>
        <p className="mt-1 text-[32px] leading-10 font-bold tracking-tight tabular-nums">
          {fmt(selected.tokenBalance)}
        </p>
        {isLow(selected) && (
          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-[var(--av2-error-text)]">
            <IconAlertCircle width={16} height={16} className="shrink-0" />
            Low balance · below {LOW_BALANCE} tokens
          </p>
        )}
        <Button variant="primary" className="mt-4 w-full" onClick={() => openAdjust(selected)}>
          Adjust tokens
        </Button>
      </div>

      <div className="mt-6">
        <PanelSection title="Subscription">
          {selected.plan ? (
            <>
              <Badge tone="lavender">{selected.plan.name}</Badge>
              <p className="mt-2 text-sm text-[var(--av2-text-2)] tabular-nums">
                {fmt(selected.plan.monthlyTokens)} tokens / month
                {!selected.plan.isActive && " · plan inactive"}
              </p>
            </>
          ) : (
            <p className="text-sm text-[var(--av2-text-2)]">No plan assigned</p>
          )}
          <div className="mt-3">
            <TextLink href="/admin/plan-assignment">Manage plan</TextLink>
          </div>
        </PanelSection>

        <PanelSection title="Workspace activity">
          <dl className="grid grid-cols-3 divide-x divide-[var(--av2-border)]">
            {[
              { label: "Members", value: selected.counts.members },
              { label: "Projects", value: selected.counts.projects },
              { label: "Tickets", value: selected.counts.tickets },
            ].map((m) => (
              <div key={m.label} className="px-4 first:pl-0">
                <dt className="text-sm text-[var(--av2-text-2)]">{m.label}</dt>
                <dd className="mt-1 text-2xl leading-8 font-bold tabular-nums">{fmt(m.value)}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3">
            <TextLink href="/admin/board">Open board</TextLink>
          </div>
        </PanelSection>

        <PanelSection title="Assignment">
          {/* Company default; projects in INHERIT mode follow it.
              Per-project ON/OFF overrides keep working unchanged. */}
          <StatusDot
            tone={selected.autoAssignDefaultEnabled ? "green" : "neutral"}
            label={
              selected.autoAssignDefaultEnabled
                ? "Auto-assignment enabled"
                : "Manual assignment (auto-assign off)"
            }
          />
          <p className="mt-2 text-sm text-[var(--av2-text-2)]">
            {selected.autoAssignDefaultEnabled
              ? "New tickets are auto-assigned to a matching creative."
              : "New tickets land unassigned for manual triage."}
          </p>
          <Button
            size="sm"
            className="mt-3"
            onClick={() => toggleAutoAssign(selected)}
            disabled={autoAssignBusyId === selected.id}
          >
            {autoAssignBusyId === selected.id
              ? "Updating…"
              : selected.autoAssignDefaultEnabled
                ? "Turn off auto-assign"
                : "Turn on auto-assign"}
          </Button>
        </PanelSection>

        <PanelSection>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-[var(--av2-text-2)]">
              Created {formatDate(selected.createdAt)}
            </span>
            <TextLink href="/admin/ledger">Token ledger</TextLink>
          </div>
        </PanelSection>
      </div>
    </DetailPanel>
  ) : null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <PageHeader title="Companies" description="Your clients, plans and balances in one place." />

      {error && (
        <div className="mb-6">
          <Callout tone="error" title="Something went wrong">
            {error}
          </Callout>
        </div>
      )}

      {autoAssignNotice && (
        <div className="mb-6">
          <Callout
            tone="success"
            title="Auto-assign"
            action={
              <Button size="sm" variant="ghost" onClick={() => setAutoAssignNotice(null)}>
                Dismiss
              </Button>
            }
          >
            {autoAssignNotice}
          </Callout>
        </div>
      )}

      <SplitView panel={panel}>
        {/* Summary cards */}
        <div
          className={`mb-6 grid gap-4 sm:grid-cols-2 ${selected ? "2xl:grid-cols-4" : "xl:grid-cols-4"}`}
        >
          <KpiCard
            icon={<IconBuilding />}
            tone="lavender"
            label="Companies"
            value={loading && !data ? DASH : fmt(stats?.totalCompanies)}
            hint={
              stats
                ? `${fmt(stats.companiesWithPlan)} with a plan`
                : "All companies in the database"
            }
          />
          <KpiCard
            icon={<IconCoins />}
            tone="green"
            label="Token balance"
            value={fmt(stats?.totalTokenBalance)}
            hint={
              stats
                ? `Avg ${fmt(Math.round(stats.avgTokenBalance))} per company`
                : "Across all companies"
            }
          />
          <KpiCard
            icon={<IconAlertCircle />}
            tone="peach"
            label="Low balance"
            value={fmt(lowCount)}
            hint={`Below ${LOW_BALANCE} tokens`}
          />
          <KpiCard
            icon={<IconFolder />}
            tone="lavender"
            label="Projects / tickets"
            value={totalProjects === null ? DASH : `${fmt(totalProjects)} / ${fmt(totalTickets)}`}
            hint="Across all companies"
          />
        </div>

        {lowCount !== null && lowCount > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--av2-attention-border)] bg-gradient-to-r from-[var(--av2-attention-from)] to-[var(--av2-attention-to)] px-6 py-4">
            <IconTile tone="red" size={40} round>
              <IconAlertCircle />
            </IconTile>
            <p className="min-w-0 flex-1 text-base font-semibold">
              {lowCount} {plural(lowCount, "company has", "companies have")} fewer than{" "}
              {LOW_BALANCE} tokens.
            </p>
            {balanceFilter !== "LOW" ? (
              <Button onClick={() => setBalanceFilter("LOW")}>Show low balance only</Button>
            ) : (
              <Button variant="ghost" onClick={() => setBalanceFilter("ALL")}>
                Show all balances
              </Button>
            )}
          </div>
        )}

        <Card padding="none">
          <div className="px-6 pt-5">
            <FilterBar
              trailing={
                data
                  ? `${fmt(filteredCompanies.length)} ${plural(filteredCompanies.length, "company", "companies")}`
                  : null
              }
            >
              <SearchInput
                className="min-w-[200px] flex-1"
                value={query}
                onChange={setQuery}
                placeholder="Search companies"
                label="Search companies by name or slug"
              />
              <div className="w-full sm:w-40">
                <Select
                  aria-label="Filter by plan"
                  value={planFilter}
                  onChange={(e) => setPlanFilter(e.target.value)}
                >
                  <option value="ALL">All plans</option>
                  <option value="WITH_PLAN">With plan</option>
                  <option value="WITHOUT_PLAN">Without plan</option>
                  {planOptions.map(([id, name]) => (
                    <option key={id} value={`plan:${id}`}>
                      {name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="w-full sm:w-40">
                <Select
                  aria-label="Filter by token balance"
                  value={balanceFilter}
                  onChange={(e) => setBalanceFilter(e.target.value as BalanceFilter)}
                >
                  <option value="ALL">All balances</option>
                  <option value="LOW">Low balance (&lt; {LOW_BALANCE})</option>
                  <option value="OK">{LOW_BALANCE}+ tokens</option>
                </Select>
              </div>
            </FilterBar>
          </div>

          {loading && !data ? (
            <div className="space-y-3 border-t border-[var(--av2-border)] px-6 py-5" role="status">
              <span className="sr-only">Loading companies…</span>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : companies.length === 0 ? (
            <div className="border-t border-[var(--av2-border)]">
              <EmptyState
                icon={<IconBuilding width={28} height={28} />}
                title="No companies yet"
                description="Companies appear here once a customer signs up and creates a workspace."
              />
            </div>
          ) : filteredCompanies.length === 0 ? (
            <div className="border-t border-[var(--av2-border)]">
              <EmptyState
                title="No companies match these filters"
                description="Try a different search, plan or balance filter."
                action={<Button onClick={resetFilters}>Clear filters</Button>}
              />
            </div>
          ) : (
            <Table label="Companies">
              <thead>
                <tr>
                  <Th>Company</Th>
                  <Th>Plan</Th>
                  <Th align="right">Tokens</Th>
                  <Th>Activity</Th>
                  <Th>Assignment</Th>
                  <Th align="right">
                    <span className="sr-only">Open</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.map((c) => (
                  <Tr
                    key={c.id}
                    selected={c.id === selectedId}
                    onSelect={() => setSelectedId(c.id)}
                    label={`${c.name}, ${fmt(c.tokenBalance)} tokens`}
                  >
                    <Td>
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-xs text-[var(--av2-text-2)]">{c.slug}</div>
                    </Td>
                    <Td>
                      {c.plan ? (
                        <>
                          <Badge tone="lavender">{c.plan.name}</Badge>
                          <div className="mt-1 text-xs whitespace-nowrap text-[var(--av2-text-2)] tabular-nums">
                            {fmt(c.plan.monthlyTokens)} tokens / month
                          </div>
                        </>
                      ) : (
                        <span className="text-[var(--av2-text-2)]">No plan</span>
                      )}
                    </Td>
                    <Td align="right">
                      <div className="text-base font-semibold">{fmt(c.tokenBalance)}</div>
                      {isLow(c) && (
                        <div className="flex justify-end">
                          <LowBalanceNote />
                        </div>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-[var(--av2-text-2)] tabular-nums">
                      <div>
                        {fmt(c.counts.tickets)} {plural(c.counts.tickets, "ticket", "tickets")}
                      </div>
                      <div className="text-xs">
                        {fmt(c.counts.members)} {plural(c.counts.members, "member", "members")}
                      </div>
                    </Td>
                    <Td>
                      {c.autoAssignDefaultEnabled ? (
                        <Badge tone="green">Auto</Badge>
                      ) : (
                        <Badge>Manual</Badge>
                      )}
                    </Td>
                    <Td align="right" className="text-[var(--av2-text-2)]">
                      <span className="inline-flex">
                        <IconChevronRight />
                      </span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}

          {data && companies.length > 0 && (
            <TableFooter>
              <span className="tabular-nums">
                Showing {fmt(filteredCompanies.length)} of {fmt(companies.length)}{" "}
                {plural(companies.length, "company", "companies")}
              </span>
              {filtersActive && (
                <Button size="sm" variant="ghost" onClick={resetFilters}>
                  Clear filters
                </Button>
              )}
            </TableFooter>
          )}
        </Card>

        {!selected && data && companies.length > 0 && (
          <p className="mt-6 flex items-center gap-2 text-sm text-[var(--av2-text-2)]">
            <IconDocument width={18} height={18} className="shrink-0" />
            Select a company to view details and manage its balance.
          </p>
        )}
      </SplitView>

      {/* Token-adjustment modal */}
      <Modal
        open={adjustTarget !== null}
        onClose={closeAdjust}
        size="md"
        className="border border-[var(--av2-border)] bg-[var(--av2-surface)]! p-6! shadow-none!"
      >
        <ModalHeader
          eyebrow="Admin adjustment"
          title={adjustTarget ? `Adjust tokens — ${adjustTarget.name}` : "Adjust tokens"}
          subtitle={
            adjustTarget
              ? `Current balance: ${adjustTarget.tokenBalance} tokens. This writes a ledger entry with reason ADMIN_ADJUSTMENT.`
              : undefined
          }
          onClose={closeAdjust}
          className="border-[var(--av2-border)]!"
        />

        <form onSubmit={submitAdjust} className="space-y-4">
          <div>
            <p id="adjust-action-label" className="mb-1.5 block text-sm font-medium">
              Action
            </p>
            <div role="group" aria-labelledby="adjust-action-label" className="flex gap-2">
              <button
                type="button"
                aria-pressed={adjustDirection === "CREDIT"}
                onClick={() => setAdjustDirection("CREDIT")}
                className={`h-10 flex-1 rounded-lg border px-3 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none ${
                  adjustDirection === "CREDIT"
                    ? "border-[var(--av2-fill-green)] bg-[var(--av2-success-bg)] text-[var(--av2-text)]"
                    : "border-[var(--av2-border)] text-[var(--av2-text-2)] hover:bg-[var(--av2-bg)]"
                }`}
              >
                + Grant tokens
              </button>
              <button
                type="button"
                aria-pressed={adjustDirection === "DEBIT"}
                onClick={() => setAdjustDirection("DEBIT")}
                className={`h-10 flex-1 rounded-lg border px-3 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none ${
                  adjustDirection === "DEBIT"
                    ? "border-[var(--av2-error)] bg-[var(--av2-selected)] text-[var(--av2-error-text)]"
                    : "border-[var(--av2-border)] text-[var(--av2-text-2)] hover:bg-[var(--av2-bg)]"
                }`}
              >
                − Revoke tokens
              </button>
            </div>
          </div>

          <Field
            label="Amount"
            htmlFor="adjust-amount"
            hint={
              adjustDirection === "DEBIT" && adjustTarget
                ? `Max revoke: ${adjustTarget.tokenBalance} (can't go below zero).`
                : undefined
            }
          >
            <TextInput
              id="adjust-amount"
              type="number"
              min={1}
              step={1}
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              placeholder="e.g. 500"
              suffix="tokens"
              autoFocus
            />
          </Field>

          <Field
            label="Reason / notes (required)"
            htmlFor="adjust-notes"
            hint="Shown on the token ledger for audit."
          >
            <TextArea
              id="adjust-notes"
              rows={3}
              value={adjustNotes}
              onChange={(e) => setAdjustNotes(e.target.value)}
              placeholder="e.g. Compensation for platform outage 2026-04-18"
              maxLength={500}
            />
          </Field>

          {/* Typed-phrase confirmation (Security Plan — L2). CREDIT needs
              "GRANT", DEBIT needs "DEBIT". Server enforces the match. */}
          <Field
            label="Confirm"
            htmlFor="adjust-confirm"
            hint={
              <>
                Type{" "}
                <strong className="font-mono text-[var(--av2-text)]">
                  {adjustDirection === "CREDIT" ? "GRANT" : "DEBIT"}
                </strong>{" "}
                to confirm this {adjustDirection === "CREDIT" ? "grant" : "debit"}.
              </>
            }
          >
            <TextInput
              id="adjust-confirm"
              type="text"
              value={adjustConfirmation}
              onChange={(e) => setAdjustConfirmation(e.target.value)}
              placeholder={adjustDirection === "CREDIT" ? "GRANT" : "DEBIT"}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>

          {adjustError && <Callout tone="error">{adjustError}</Callout>}

          <ModalFooter>
            <Button variant="ghost" type="button" onClick={closeAdjust} disabled={adjustSaving}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={adjustDirection === "CREDIT" ? "primary" : "danger"}
              disabled={adjustSaving}
              aria-busy={adjustSaving}
            >
              {adjustSaving
                ? "Saving…"
                : `${adjustDirection === "CREDIT" ? "Grant" : "Revoke"} ${adjustAmount ? adjustAmount : ""} tokens`.replace(
                    /\s+/g,
                    " ",
                  )}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Confirm sweeping the existing backlog when enabling auto-assign. */}
      <Modal
        open={autoAssignConfirm !== null}
        onClose={() => setAutoAssignConfirm(null)}
        size="md"
        className="border border-[var(--av2-border)] bg-[var(--av2-surface)]! p-6! shadow-none!"
      >
        <ModalHeader
          eyebrow="Auto-assign"
          title={
            autoAssignConfirm
              ? `Enable auto-assign — ${autoAssignConfirm.company.name}`
              : "Enable auto-assign"
          }
          onClose={() => setAutoAssignConfirm(null)}
          className="border-[var(--av2-border)]!"
        />
        <div className="space-y-3">
          <p className="text-sm text-[var(--av2-text-2)]">
            New tickets will be auto-assigned to a matching creative. This company also has{" "}
            <strong className="text-[var(--av2-text)] tabular-nums">
              {autoAssignConfirm?.unassignedCount}
            </strong>{" "}
            unassigned to-do ticket{autoAssignConfirm?.unassignedCount === 1 ? "" : "s"} already in
            the backlog. Assign those now too?
          </p>
          <p className="text-xs text-[var(--av2-text-2)]">
            Tickets in projects with auto-assign turned off, or with no eligible creative, are left
            unassigned.
          </p>
          <ModalFooter>
            <Button
              variant="ghost"
              type="button"
              onClick={() =>
                autoAssignConfirm && patchAutoAssign(autoAssignConfirm.company, true, false)
              }
              disabled={autoAssignBusyId !== null}
            >
              Just enable
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={autoAssignBusyId !== null}
              aria-busy={autoAssignBusyId !== null}
              onClick={() =>
                autoAssignConfirm && patchAutoAssign(autoAssignConfirm.company, true, true)
              }
            >
              {autoAssignBusyId !== null
                ? "Assigning…"
                : `Enable & assign ${autoAssignConfirm?.unassignedCount ?? ""}`}
            </Button>
          </ModalFooter>
        </div>
      </Modal>

      {/* L4 MFA. Opens when the grant POST returns 202; on verify success
          re-runs the original POST with the same body. */}
      <MfaChallengeModal
        open={pendingMfa !== null}
        challenge={pendingMfa?.challenge ?? null}
        onClose={() => setPendingMfa(null)}
        onVerified={async () => {
          if (!pendingMfa) return;
          const retry = pendingMfa.retry;
          setPendingMfa(null);
          await retry();
        }}
      />
    </>
  );
}
