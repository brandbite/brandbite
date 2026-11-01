// -----------------------------------------------------------------------------
// @file: app/admin/payout-rules/page.tsx
// @purpose: Admin-facing management of payout rules (gamification tiers).
//           Tier list on the left, editor panel on the right with a
//           read-only worked example built from the real base rate and the
//           token-engine payout formula (highest qualifying rate wins;
//           rates are never summed).
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-11-01
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/toast-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useSessionRole } from "@/lib/hooks/use-session-role";
import { useUnsavedChanges } from "@/components/admin/v2/unsaved-changes";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardTitle,
  DASH,
  DetailPanel,
  EmptyState,
  Field,
  IconTile,
  KeyValueList,
  KpiCard,
  PanelSection,
  PageHeader,
  SaveBar,
  Select,
  Skeleton,
  SplitView,
  Switch,
  Table,
  TableFooter,
  Td,
  TextArea,
  TextInput,
  Th,
  Tr,
  fmt,
  plural,
} from "@/components/admin/v2/ui";
import { IconCoins, IconDocument } from "@/components/admin/v2/icons";

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

type ActiveFilter = "ALL" | "ACTIVE" | "INACTIVE";

/** Illustration job size for the worked example (not a real job type). */
const EXAMPLE_JOB_TOKENS = 100;

/** Mirrors lib/token-engine.ts: round(tokenCost × quantity × percent / 100). */
const payoutFor = (jobTokens: number, percent: number) => Math.round(jobTokens * (percent / 100));

function formatTimeWindow(days: number): string {
  if (days % 365 === 0) return `${days / 365} year${days / 365 > 1 ? "s" : ""}`;
  if (days % 30 === 0) return `${days / 30} month${days / 30 > 1 ? "s" : ""}`;
  return `${days} day${days > 1 ? "s" : ""}`;
}

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
};

function IconPlus() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconPercent({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19 5 5 19" />
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="17" cy="17" r="2.5" />
    </svg>
  );
}

function IconTrendUp({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m3 17 6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
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

/** Same rule as the shared OwnerOnlyBanner, drawn with the v2 Callout. */
function OwnerOnlyNote({ action }: { action: string }) {
  const { isSiteOwner, loading } = useSessionRole();
  if (loading || isSiteOwner) return null;
  return (
    <div className="mb-6" role="note">
      <Callout tone="warning" title="Site owner only">
        Site admins can view this page, but only the site owner can {action}. Requests from admins
        will be rejected with a 403.
      </Callout>
    </div>
  );
}

export default function AdminPayoutRulesPage() {
  const { showToast } = useToast();
  const [data, setData] = useState<PayoutRulesResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [filterActive, setFilterActive] = useState<ActiveFilter>("ALL");

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
  const [confirmDelete, setConfirmDelete] = useState(false);

  const rules = useMemo(() => data?.payoutRules ?? [], [data]);
  const basePayout = data?.basePayoutPercent ?? 60;

  const filteredRules = useMemo(() => {
    return rules.filter((r) => {
      if (filterActive === "ACTIVE") return r.isActive;
      if (filterActive === "INACTIVE") return !r.isActive;
      return true;
    });
  }, [rules, filterActive]);

  const activeRules = useMemo(
    () => rules.filter((r) => r.isActive).sort((a, b) => b.payoutPercent - a.payoutPercent),
    [rules],
  );
  const activeCount = activeRules.length;
  const highestActive = activeRules.reduce((max, r) => Math.max(max, r.payoutPercent), 0);

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

  const load = async (): Promise<PayoutRule[] | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/payout-rules", { cache: "no-store" });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401)
          throw new Error("You must be signed in as an admin to view this page.");
        if (res.status === 403)
          throw new Error("You do not have permission to manage payout rules.");
        throw new Error(json?.error || `Request failed with status ${res.status}`);
      }

      setData(json as PayoutRulesResponse);
      return (json as PayoutRulesResponse).payoutRules ?? [];
    } catch (err: any) {
      console.error("Admin payout rules fetch error:", err);
      setError(err?.message || "Failed to load payout rules.");
      return null;
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
  }, []);

  // Dirty state for the SaveBar — compares the editor against the selected
  // rule (or the blank "new rule" form).
  const baseline = selected
    ? {
        name: selected.name,
        description: selected.description ?? "",
        minTickets: String(selected.minCompletedTickets),
        windowDays: String(selected.timeWindowDays),
        payout: String(selected.payoutPercent),
        priority: String(selected.priority),
        isActive: selected.isActive,
      }
    : {
        name: "",
        description: "",
        minTickets: "",
        windowDays: "",
        payout: "",
        priority: "",
        isActive: true,
      };
  const dirty =
    formName !== baseline.name ||
    formDescription !== baseline.description ||
    formMinTickets !== baseline.minTickets ||
    formTimeWindowDays !== baseline.windowDays ||
    formPayoutPercent !== baseline.payout ||
    formPriority !== baseline.priority ||
    formIsActive !== baseline.isActive;
  const confirmDiscard = useUnsavedChanges(dirty, selected ? `Rule: ${selected.name}` : "New rule");

  const handleEditClick = async (r: PayoutRule) => {
    if (r.id === selected?.id) return;
    if (!(await confirmDiscard())) return;
    fillFormFromSelection(r);
  };

  // "New rule" and closing the editor both reset the form.
  const handleNewClick = async () => {
    if (!(await confirmDiscard())) return;
    resetForm();
  };

  const discardChanges = () => {
    if (selected) {
      fillFormFromSelection(selected);
    } else {
      resetForm();
    }
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

      const msg = isEditing
        ? "Payout rule updated successfully."
        : "Payout rule created successfully.";
      showToast({ type: "success", title: msg });

      const fresh = await load();

      if (!isEditing) {
        resetForm();
      } else {
        // Re-sync the editor with the saved record so the dirty state clears.
        const updated = fresh?.find((r) => r.id === selected?.id);
        if (updated) fillFormFromSelection(updated);
      }
      setSaveSuccess(msg);
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

  // ---------------------------------------------------------------------------
  // Worked example (read-only). Uses the real base rate from the API and the
  // token-engine formula; the job size is an illustration.
  // ---------------------------------------------------------------------------

  const editedPercent = parseInt(formPayoutPercent, 10);
  const hasEditedPercent = Number.isFinite(editedPercent);
  const exampleLabel = formName.trim() || (selected ? selected.name : "This rule");
  const pointsAboveBase = hasEditedPercent ? editedPercent - basePayout : null;

  // Two highest active saved rules → "qualifies for both, highest wins".
  const [topRule, secondRule] = activeRules;

  const workedExample = (
    <PanelSection
      title="Payout example"
      action={
        <span className="text-xs text-[var(--av2-text-2)] tabular-nums">
          Illustration · {fmt(EXAMPLE_JOB_TOKENS)}-token job
        </span>
      }
    >
      <div className="rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-bg)] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <IconTile tone="lavender" size={40}>
              <IconCoins />
            </IconTile>
            <div className="min-w-0">
              <p className="text-xs text-[var(--av2-text-2)]">Base rate</p>
              <p className="text-xl leading-7 font-bold tabular-nums">{fmt(basePayout)}%</p>
              <p className="text-xs text-[var(--av2-text-2)] tabular-nums">
                {fmt(payoutFor(EXAMPLE_JOB_TOKENS, basePayout))} tokens
              </p>
            </div>
          </div>
          <span className="text-[var(--av2-text-2)]">
            <IconArrowRight />
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <IconTile tone="peach" size={40}>
              <IconTrendUp size={20} />
            </IconTile>
            <div className="min-w-0">
              <p className="truncate text-xs text-[var(--av2-text-2)]">{exampleLabel}</p>
              <p className="text-xl leading-7 font-bold tabular-nums">
                {hasEditedPercent ? `${fmt(editedPercent)}%` : DASH}
              </p>
              <p className="text-xs text-[var(--av2-text-2)] tabular-nums">
                {hasEditedPercent
                  ? `${fmt(payoutFor(EXAMPLE_JOB_TOKENS, editedPercent))} tokens`
                  : "Enter a payout rate"}
              </p>
            </div>
          </div>
        </div>
        {pointsAboveBase !== null && (
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-center text-sm font-medium tabular-nums ${
              pointsAboveBase > 0
                ? "bg-[var(--av2-selected)] text-[var(--av2-link)]"
                : "bg-[var(--av2-surface)] text-[var(--av2-error-text)]"
            }`}
          >
            {pointsAboveBase > 0
              ? `+${fmt(pointsAboveBase)} percentage ${plural(pointsAboveBase, "point", "points")} above base`
              : `Not above the base rate of ${fmt(basePayout)}%`}
          </p>
        )}
      </div>
      <ul className="mt-3 space-y-1.5 text-sm text-[var(--av2-text-2)]">
        <li>
          If several rules qualify, only the highest rate is used. Rates are never added together.
        </li>
        {topRule && secondRule && (
          <li>
            A creative who qualifies for both {secondRule.name} ({fmt(secondRule.payoutPercent)}%)
            and {topRule.name} ({fmt(topRule.payoutPercent)}%) is paid{" "}
            <span className="font-semibold text-[var(--av2-text)]">
              {fmt(topRule.payoutPercent)}%
            </span>
            , not {fmt(topRule.payoutPercent + secondRule.payoutPercent)}%.
          </li>
        )}
        <li>A per-ticket payout override, when set, takes precedence over every rule.</li>
      </ul>
    </PanelSection>
  );

  // ---------------------------------------------------------------------------
  // Editor panel
  // ---------------------------------------------------------------------------

  const panelTitle = (
    <span className="flex min-w-0 flex-wrap items-center gap-3">
      <span className="truncate">{selected ? selected.name : "New rule"}</span>
      {selected ? (
        selected.isActive ? (
          <Badge tone="green">Active</Badge>
        ) : (
          <Badge>Inactive</Badge>
        )
      ) : (
        <Badge tone="peach">Draft</Badge>
      )}
    </span>
  );

  const panel = (
    <form onSubmit={handleSubmit} className="contents">
      <DetailPanel
        title={panelTitle}
        onClose={selected ? handleNewClick : undefined}
        closeLabel="Clear selection"
        footer={
          <SaveBar
            dirty={dirty}
            status={
              saving
                ? "Saving…"
                : dirty
                  ? "Unsaved changes"
                  : saveSuccess
                    ? saveSuccess
                    : "No unsaved changes"
            }
          >
            {dirty && (
              <Button variant="ghost" disabled={saving} onClick={discardChanges}>
                Discard
              </Button>
            )}
            <Button type="submit" variant="primary" disabled={!dirty || saving}>
              {saving ? "Saving…" : selected ? "Save rule" : "Create rule"}
            </Button>
          </SaveBar>
        }
      >
        <p className="mb-5 text-sm text-[var(--av2-text-2)]">
          Creatives who meet these conditions earn this rate instead of the base rate.
        </p>

        {saveError && (
          <div className="mb-5">
            <Callout tone="error" title="Couldn't save the rule">
              {saveError}
            </Callout>
          </div>
        )}

        <PanelSection title="Details">
          <div className="space-y-5">
            <Field label="Name" htmlFor="rule-name">
              <TextInput
                id="rule-name"
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                placeholder='e.g. "Gold Tier"'
              />
            </Field>

            <Field label="Description" htmlFor="rule-description">
              <TextArea
                id="rule-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
                placeholder="Optional description shown to creatives."
              />
            </Field>
          </div>
        </PanelSection>

        <PanelSection title="Conditions">
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Min. completed tickets"
                htmlFor="rule-min-tickets"
                hint="Tickets completed within the window."
              >
                <TextInput
                  id="rule-min-tickets"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={formMinTickets}
                  onChange={(e) => setFormMinTickets(e.target.value)}
                  required
                  placeholder="e.g. 100"
                  suffix="tickets"
                />
              </Field>

              <Field
                label="Time window"
                htmlFor="rule-window"
                hint="90 = 3 months, 180 = 6 months, 365 = 1 year"
              >
                <TextInput
                  id="rule-window"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={formTimeWindowDays}
                  onChange={(e) => setFormTimeWindowDays(e.target.value)}
                  required
                  placeholder="e.g. 180"
                  suffix="days"
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Payout rate"
                htmlFor="rule-payout"
                hint={`Must be above the base rate of ${basePayout}%.`}
              >
                <TextInput
                  id="rule-payout"
                  type="number"
                  min={basePayout + 1}
                  max={100}
                  inputMode="numeric"
                  value={formPayoutPercent}
                  onChange={(e) => setFormPayoutPercent(e.target.value)}
                  required
                  placeholder="e.g. 70"
                  suffix="%"
                />
              </Field>

              <Field label="Priority" htmlFor="rule-priority" hint="Display ordering (optional).">
                <TextInput
                  id="rule-priority"
                  type="number"
                  inputMode="numeric"
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value)}
                  placeholder="0"
                />
              </Field>
            </div>

            <div>
              <Switch
                checked={formIsActive}
                onChange={setFormIsActive}
                label="Rule active"
                describedBy="rule-active-hint"
              />
              <p id="rule-active-hint" className="mt-1.5 text-xs text-[var(--av2-text-2)]">
                {formIsActive
                  ? "Active — evaluated when a creative's ticket is completed."
                  : "Inactive — ignored when payouts are calculated."}
              </p>
            </div>
          </div>
        </PanelSection>

        {workedExample}

        {selected && (
          <PanelSection title="Record">
            <KeyValueList
              rows={[
                { label: "Created", value: formatDate(selected.createdAt) },
                { label: "Last updated", value: formatDate(selected.updatedAt) },
              ]}
            />
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[var(--av2-text-2)]">
                Deleting removes this tier immediately.
              </p>
              <Button
                variant="danger"
                size="sm"
                disabled={deleting || saving}
                aria-busy={deleting}
                onClick={() => setConfirmDelete(true)}
              >
                {deleting ? "Deleting…" : "Delete rule"}
              </Button>
            </div>
          </PanelSection>
        )}
      </DetailPanel>
    </form>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const kpiLoading = loading && !data;

  return (
    <>
      <PageHeader
        title="Payout rules"
        description="Reward completed work with clear milestone-based rates."
        actions={
          <Button variant="primary" onClick={handleNewClick}>
            <IconPlus />
            New rule
          </Button>
        }
      />

      <OwnerOnlyNote action="create, edit, or delete payout rules" />

      {error && (
        <div className="mb-6">
          <Callout tone="error" title="Error">
            {error}
          </Callout>
        </div>
      )}

      <div className="mb-6 grid gap-6 sm:grid-cols-3">
        <KpiCard
          icon={<IconPercent />}
          tone="peach"
          label="Base payout"
          value={kpiLoading || !data ? DASH : `${fmt(basePayout)}%`}
          hint="Base rate for all creatives"
        />
        <KpiCard
          icon={<IconDocument />}
          tone="lavender"
          label="Active rules"
          value={kpiLoading ? DASH : fmt(data ? activeCount : null)}
          hint={
            data
              ? `${fmt(rules.length)} ${plural(rules.length, "rule", "rules")} configured`
              : "Rules being evaluated for creatives"
          }
        />
        <KpiCard
          icon={<IconTrendUp />}
          tone="green"
          label="Highest active rate"
          value={
            kpiLoading || !data
              ? DASH
              : highestActive > 0
                ? `${fmt(highestActive)}%`
                : `${fmt(basePayout)}%`
          }
          hint={highestActive > 0 ? "Top tier payout rate" : "Only base rate active"}
        />
      </div>

      <SplitView panel={panel}>
        <Card padding="none">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5 pb-4">
            <CardTitle>Milestone rules</CardTitle>
            <div className="w-full sm:w-44">
              <Select
                aria-label="Filter by status"
                value={filterActive}
                onChange={(e) => setFilterActive(e.target.value as ActiveFilter)}
              >
                <option value="ALL">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </div>
          </div>

          {loading && !data ? (
            <div className="space-y-3 border-t border-[var(--av2-border)] px-6 py-5" role="status">
              <span className="sr-only">Loading payout rules…</span>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : rules.length === 0 ? (
            <div className="border-t border-[var(--av2-border)]">
              <EmptyState
                icon={<IconPercent size={28} />}
                title="No payout rules yet"
                description={`Every creative earns the base rate${data ? ` of ${basePayout}%` : ""}. Create a rule in the panel to reward milestones.`}
              />
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="border-t border-[var(--av2-border)]">
              <EmptyState
                title="No payout rules match this filter"
                description="Try a different status."
                action={<Button onClick={() => setFilterActive("ALL")}>Show all rules</Button>}
              />
            </div>
          ) : (
            <Table label="Payout rules">
              <thead>
                <tr>
                  <Th>Rule</Th>
                  <Th align="right">Completed tickets</Th>
                  <Th align="right">Window</Th>
                  <Th align="right">Payout</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {filteredRules.map((r) => (
                  <Tr
                    key={r.id}
                    selected={selected?.id === r.id}
                    onSelect={() => handleEditClick(r)}
                    label={`${r.name}, ${r.payoutPercent}% payout`}
                  >
                    <Td>
                      <div className="font-semibold">{r.name}</div>
                      <div className="mt-0.5 text-xs text-[var(--av2-text-2)]">
                        {r.description ||
                          `Complete ${fmt(r.minCompletedTickets)} ${plural(r.minCompletedTickets, "ticket", "tickets")} in ${formatTimeWindow(r.timeWindowDays)} to earn ${r.payoutPercent}%.`}
                      </div>
                    </Td>
                    <Td align="right" className="whitespace-nowrap">
                      {fmt(r.minCompletedTickets)}
                      <span className="ml-1 text-xs text-[var(--av2-text-2)]">
                        {plural(r.minCompletedTickets, "ticket", "tickets")}
                      </span>
                    </Td>
                    <Td align="right" className="whitespace-nowrap">
                      {formatTimeWindow(r.timeWindowDays)}
                    </Td>
                    <Td align="right" className="text-base font-semibold whitespace-nowrap">
                      {fmt(r.payoutPercent)}%
                    </Td>
                    <Td>
                      {r.isActive ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}

          {data && rules.length > 0 && (
            <TableFooter>
              <span>The highest qualifying rate applies. Rates are not added together.</span>
              <span className="tabular-nums">
                Showing {fmt(filteredRules.length)} of {fmt(rules.length)}{" "}
                {plural(rules.length, "rule", "rules")}
              </span>
            </TableFooter>
          )}
        </Card>
      </SplitView>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => !deleting && setConfirmDelete(false)}
        onConfirm={async () => {
          await handleDelete();
          setConfirmDelete(false);
        }}
        loading={deleting}
        variant="danger"
        title="Delete this payout rule?"
        description={
          selected
            ? `"${selected.name}" will be removed immediately and stop applying to new completed tickets.`
            : undefined
        }
        confirmLabel="Delete rule"
        cancelLabel="Keep rule"
      />
    </>
  );
}
