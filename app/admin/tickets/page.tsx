// -----------------------------------------------------------------------------
// @file: app/admin/tickets/page.tsx
// @purpose: Admin-facing ticket list & creative assignment screen with token
//           cost / payout override support. Admin design language v1: row
//           list on the left, "Manage ticket" detail panel on the right that
//           holds assignment + pricing edits behind an explicit Apply.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-01
// -----------------------------------------------------------------------------

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { buildTicketCode } from "@/lib/ticket-code";
import {
  Badge,
  Button,
  Callout,
  Card,
  DASH,
  DetailPanel,
  EmptyState,
  Field,
  KeyValueList,
  PRIORITY,
  PageHeader,
  PanelSection,
  SaveBar,
  SearchInput,
  SegmentedControl,
  Select,
  Skeleton,
  TICKET_STATUS,
  TabPanel,
  Table,
  TableFooter,
  Tabs,
  Td,
  TextInput,
  TextLink,
  Th,
  Tr,
  fmt,
  plural,
} from "@/components/admin/v2/ui";
import { IconTicket } from "@/components/admin/v2/icons";

type TicketStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type AdminCreative = {
  id: string;
  name: string | null;
  email: string;
};

type AdminTicket = {
  id: string;
  title: string;
  status: TicketStatus;
  createdAt: string;
  quantity: number;
  tokenCostOverride: number | null;
  creativePayoutOverride: number | null;
  /// Returned by GET /api/admin/tickets; used for the human-readable code.
  companyTicketNumber?: number | null;
  company: {
    id: string;
    name: string;
  } | null;
  project: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  creative: AdminCreative | null;
  jobType: {
    id: string;
    name: string;
    tokenCost: number;
    creativePayoutTokens: number;
  } | null;
};

type AdminTicketsResponse = {
  tickets: AdminTicket[];
  creatives: AdminCreative[];
};

// Local draft state for override editing
type OverrideDraft = {
  costOverride: string;
  payoutOverride: string;
};

type PanelTab = "assignment" | "pricing";

/** Mirror of server-side sanity cap — keep in sync with TOKEN_OVERRIDE_MAX
 *  in app/api/admin/tickets/route.ts. */
const TOKEN_OVERRIDE_MAX = 1_000_000;

/** When the admin sets an override that's this many × above the JobType
 *  default, show a confirm dialog before saving. Catches the "typed one
 *  extra zero" class of bugs. */
const OVERRIDE_CONFIRM_MULTIPLIER = 10;

const STATUS_KEYS: TicketStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
const PRIORITY_KEYS: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

const VIEW_OPTIONS = [
  { value: "board", label: "Kanban", href: "/admin/board" },
  { value: "table", label: "Table", href: "/admin/tickets" },
];

const PANEL_ID = "manage-ticket";

function getEffectiveCost(t: AdminTicket): number | null {
  if (!t.jobType) return null;
  return t.tokenCostOverride ?? t.jobType.tokenCost * (t.quantity ?? 1);
}

function getEffectivePayout(t: AdminTicket): number | null {
  if (!t.jobType) return null;
  return t.creativePayoutOverride ?? t.jobType.creativePayoutTokens * (t.quantity ?? 1);
}

function initialDraft(t: AdminTicket): OverrideDraft {
  return {
    costOverride: t.tokenCostOverride != null ? String(t.tokenCostOverride) : "",
    payoutOverride: t.creativePayoutOverride != null ? String(t.creativePayoutOverride) : "",
  };
}

/** Page-local warning triangle (v2 icon family: 24px grid, 1.75 stroke). */
function IconWarning({ label }: { label?: string }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="shrink-0 text-[var(--av2-accent)]"
    >
      {label && <title>{label}</title>}
      <path d="M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4.5M12 17h.01" />
    </svg>
  );
}

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

const CHECKBOX =
  "h-4 w-4 cursor-pointer rounded border-[var(--av2-border)] accent-[var(--av2-accent-strong)] dark:[color-scheme:dark] focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)]";

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [creatives, setCreatives] = useState<AdminCreative[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [savingTicketId, setSavingTicketId] = useState<string | null>(null);

  // Override editing — keyed by ticket id
  const [editingOverrides, setEditingOverrides] = useState<Record<string, OverrideDraft>>({});
  // Assignment drafts — keyed by ticket id ("" = unassigned)
  const [assignDrafts, setAssignDrafts] = useState<Record<string, string>>({});

  // Detail panel
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<PanelTab>("assignment");
  const panelRef = useRef<HTMLDivElement>(null);

  // Client-side filters over the fetched list
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [creativeFilter, setCreativeFilter] = useState("ALL");

  // Bulk selection + action bar
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [bulkCreativeId, setBulkCreativeId] = useState<string>(""); // "" = placeholder, "__none__" = unassign
  const [bulkStatus, setBulkStatus] = useState<TicketStatus | "">("");
  const [bulkPriority, setBulkPriority] = useState<TicketPriority | "">("");

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tickets", {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as
        | AdminTicketsResponse
        | { error?: string }
        | null;

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("You need to sign in as an admin to view this page.");
        }
        if (res.status === 403) {
          throw new Error("Only site owners or admins can manage tickets from this screen.");
        }
        throw new Error(
          json && "error" in json && json.error
            ? json.error
            : `Request failed with status ${res.status}`,
        );
      }

      if (!json || !("tickets" in json)) {
        throw new Error("Unexpected response format from server.");
      }

      setTickets(json.tickets);
      setCreatives(json.creatives);
    } catch (err) {
      console.error("[AdminTicketsPage] load error", err);
      setError(err instanceof Error ? err.message : "Failed to load tickets. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAssignCreative = async (ticketId: string, creativeId: string | null) => {
    setError(null);
    setSavingTicketId(ticketId);
    try {
      const res = await fetch("/api/admin/tickets", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ticketId,
          creativeId,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("You need to sign in as an admin to update tickets.");
        }
        if (res.status === 403) {
          throw new Error(json?.error || "Only site owners or admins can assign creatives.");
        }
        throw new Error(json?.error || `Request failed with status ${res.status}`);
      }

      const updatedCreative: AdminCreative | null = json?.creative ?? null;

      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, creative: updatedCreative } : t)),
      );
      setAssignDrafts((prev) => {
        const next = { ...prev };
        delete next[ticketId];
        return next;
      });
    } catch (err) {
      console.error("[AdminTicketsPage] assign error", err);
      setError(err instanceof Error ? err.message : "Failed to assign creative. Please try again.");
    } finally {
      setSavingTicketId(null);
    }
  };

  // -------------------------------------------------------------------------
  // Override editing helpers
  // -------------------------------------------------------------------------

  const updateOverrideDraft = (t: AdminTicket, patch: Partial<OverrideDraft>) => {
    setEditingOverrides((prev) => ({
      ...prev,
      [t.id]: { ...(prev[t.id] ?? initialDraft(t)), ...patch },
    }));
  };

  const cancelEditingOverrides = (ticketId: string) => {
    setEditingOverrides((prev) => {
      const next = { ...prev };
      delete next[ticketId];
      return next;
    });
  };

  const handleSaveOverrides = async (ticketId: string) => {
    const draft = editingOverrides[ticketId];
    if (!draft) return;

    setError(null);
    setSavingTicketId(ticketId);

    try {
      const costVal = draft.costOverride.trim();
      const payoutVal = draft.payoutOverride.trim();

      const payload: Record<string, unknown> = { ticketId };

      // Empty string → clear override (null), number → set
      payload.tokenCostOverride = costVal === "" ? null : parseInt(costVal, 10);
      payload.creativePayoutOverride = payoutVal === "" ? null : parseInt(payoutVal, 10);

      // Validate
      const costNum = payload.tokenCostOverride as number | null;
      const payoutNum = payload.creativePayoutOverride as number | null;
      if (costVal !== "" && (isNaN(costNum as number) || (costNum as number) < 0)) {
        setError("Cost override must be a non-negative number.");
        return;
      }
      if (payoutVal !== "" && (isNaN(payoutNum as number) || (payoutNum as number) < 0)) {
        setError("Payout override must be a non-negative number.");
        return;
      }
      if (costVal !== "" && (costNum as number) > TOKEN_OVERRIDE_MAX) {
        setError(
          `Cost override cannot exceed ${TOKEN_OVERRIDE_MAX.toLocaleString()}. Split larger jobs into multiple tickets.`,
        );
        return;
      }
      if (payoutVal !== "" && (payoutNum as number) > TOKEN_OVERRIDE_MAX) {
        setError(
          `Payout override cannot exceed ${TOKEN_OVERRIDE_MAX.toLocaleString()}. Split larger jobs into multiple tickets.`,
        );
        return;
      }

      // "Did you really mean that many zeros?" check.
      // Compare each override against its JobType default (scaled by quantity).
      const ticket = tickets.find((t) => t.id === ticketId);
      const jobType = ticket?.jobType;
      if (jobType) {
        const qty = ticket?.quantity ?? 1;
        const defaultCost = jobType.tokenCost * qty;
        const defaultPayout = jobType.creativePayoutTokens * qty;
        const warnings: string[] = [];
        if (
          costVal !== "" &&
          defaultCost > 0 &&
          (costNum as number) > defaultCost * OVERRIDE_CONFIRM_MULTIPLIER
        ) {
          warnings.push(
            `Cost override (${(costNum as number).toLocaleString()}) is more than ${OVERRIDE_CONFIRM_MULTIPLIER}× the default (${defaultCost.toLocaleString()}).`,
          );
        }
        if (
          payoutVal !== "" &&
          defaultPayout > 0 &&
          (payoutNum as number) > defaultPayout * OVERRIDE_CONFIRM_MULTIPLIER
        ) {
          warnings.push(
            `Payout override (${(payoutNum as number).toLocaleString()}) is more than ${OVERRIDE_CONFIRM_MULTIPLIER}× the default (${defaultPayout.toLocaleString()}).`,
          );
        }
        if (warnings.length > 0) {
          const ok = window.confirm(
            `${warnings.join("\n")}\n\nAre you sure? This debits the company immediately.`,
          );
          if (!ok) return;
        }
      }

      const res = await fetch("/api/admin/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || `Request failed with status ${res.status}`);
      }

      // Update local state with response
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId
            ? {
                ...t,
                tokenCostOverride: json.tokenCostOverride ?? null,
                creativePayoutOverride: json.creativePayoutOverride ?? null,
                jobType: json.jobType ?? t.jobType,
                creative: json.creative ?? t.creative,
              }
            : t,
        ),
      );

      cancelEditingOverrides(ticketId);
    } catch (err) {
      console.error("[AdminTicketsPage] save overrides error", err);
      setError(err instanceof Error ? err.message : "Failed to save overrides. Please try again.");
    } finally {
      setSavingTicketId(null);
    }
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString();
  };

  // -------------------------------------------------------------------------
  // Bulk ops
  // -------------------------------------------------------------------------
  type BulkPayload =
    | { op: "reassign"; creativeId: string | null }
    | { op: "status"; status: TicketStatus }
    | { op: "priority"; priority: TicketPriority };

  const runBulk = async (payload: BulkPayload) => {
    if (selectedIds.size === 0) return;
    setBulkSaving(true);
    setBulkMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/tickets/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketIds: Array.from(selectedIds), ...payload }),
      });
      const json = (await res.json().catch(() => null)) as {
        succeeded?: string[];
        failed?: { id: string; error: string }[];
        error?: string;
      } | null;
      if (!res.ok) throw new Error(json?.error || `Request failed with status ${res.status}`);

      const ok = json?.succeeded?.length ?? 0;
      const bad = json?.failed?.length ?? 0;
      setBulkMessage(
        bad === 0
          ? `Updated ${ok} ticket${ok === 1 ? "" : "s"}.`
          : `Updated ${ok}, failed ${bad}. First error: ${json?.failed?.[0]?.error ?? "unknown"}`,
      );

      // Refresh the table from server — cheap and keeps everything consistent.
      await load();
      clearSelection();
      setBulkCreativeId("");
      setBulkStatus("");
      setBulkPriority("");
    } catch (err) {
      console.error("[AdminTicketsPage] bulk op error", err);
      setError(err instanceof Error ? err.message : "Bulk op failed.");
    } finally {
      setBulkSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------------

  const statusCounts = useMemo(() => {
    const c: Record<TicketStatus, number> = { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 };
    tickets.forEach((t) => {
      if (t.status in c) c[t.status]++;
    });
    return c;
  }, [tickets]);

  const companies = useMemo(() => {
    const m = new Map<string, string>();
    tickets.forEach((t) => t.company && m.set(t.company.id, t.company.name));
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [tickets]);

  const filtersActive =
    search.trim() !== "" ||
    companyFilter !== "ALL" ||
    statusFilter !== "ALL" ||
    creativeFilter !== "ALL";

  const clearFilters = () => {
    setSearch("");
    setCompanyFilter("ALL");
    setStatusFilter("ALL");
    setCreativeFilter("ALL");
  };

  const visibleTickets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (companyFilter !== "ALL" && t.company?.id !== companyFilter) return false;
      if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
      if (creativeFilter === "__none__" && t.creative) return false;
      if (
        creativeFilter !== "ALL" &&
        creativeFilter !== "__none__" &&
        t.creative?.id !== creativeFilter
      )
        return false;
      if (q) {
        const hay = [
          t.title,
          t.company?.name ?? "",
          t.project?.name ?? "",
          t.project?.code ?? "",
          t.jobType?.name ?? "",
          t.creative?.name ?? "",
          t.creative?.email ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tickets, search, companyFilter, statusFilter, creativeFilter]);

  const activeTicket = activeTicketId
    ? (tickets.find((t) => t.id === activeTicketId) ?? null)
    : null;

  const openTicket = (id: string) => {
    setActiveTicketId(id);
    // Below xl the panel stacks under the list — bring it into view.
    if (typeof window !== "undefined" && window.innerWidth < 1280) {
      requestAnimationFrame(() =>
        panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  };

  const allVisibleSelected =
    visibleTickets.length > 0 && visibleTickets.every((t) => selectedIds.has(t.id));

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const summary =
    loading && tickets.length === 0 ? null : (
      <p className="text-sm text-[var(--av2-text-2)] tabular-nums">
        {fmt(tickets.length)} {plural(tickets.length, "ticket", "tickets")}
        {STATUS_KEYS.map((s) => (
          <span key={s}>
            {" · "}
            {statusCounts[s]} {TICKET_STATUS[s].label.toLowerCase()}
          </span>
        ))}
      </p>
    );

  const panel = activeTicket ? (
    <div ref={panelRef} className="scroll-mt-24">
      <ManageTicketPanel
        key={activeTicket.id}
        ticket={activeTicket}
        creatives={creatives}
        tab={panelTab}
        onTab={setPanelTab}
        onClose={() => setActiveTicketId(null)}
        saving={savingTicketId === activeTicket.id}
        overrideDraft={editingOverrides[activeTicket.id] ?? null}
        onOverrideChange={(patch) => updateOverrideDraft(activeTicket, patch)}
        onDiscardOverrides={() => cancelEditingOverrides(activeTicket.id)}
        onApplyOverrides={() => handleSaveOverrides(activeTicket.id)}
        assignDraft={
          activeTicket.id in assignDrafts
            ? assignDrafts[activeTicket.id]
            : (activeTicket.creative?.id ?? "")
        }
        onAssignChange={(v) => setAssignDrafts((prev) => ({ ...prev, [activeTicket.id]: v }))}
        onDiscardAssign={() =>
          setAssignDrafts((prev) => {
            const next = { ...prev };
            delete next[activeTicket.id];
            return next;
          })
        }
        onApplyAssign={(v) => handleAssignCreative(activeTicket.id, v || null)}
        error={error}
        formatDateTime={formatDateTime}
      />
    </div>
  ) : tickets.length > 0 ? (
    <div className="hidden xl:block">
      <Card className="xl:sticky xl:top-24">
        <EmptyState
          icon={<IconTicket width={28} height={28} />}
          title="Select a ticket"
          description="Pick a row to assign a creative or review its token pricing."
        />
      </Card>
    </div>
  ) : null;

  return (
    <div>
      <PageHeader
        title="Tickets"
        description="Assign creatives and review ticket pricing."
        actions={
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {summary}
            <SegmentedControl label="Board view" value="table" options={VIEW_OPTIONS} />
          </div>
        }
      />

      {error && !activeTicket && (
        <div className="mb-6">
          <Callout tone="error" title="Something went wrong">
            {error}
          </Callout>
        </div>
      )}

      {bulkMessage && (
        <div className="mb-4">
          <Callout
            tone="success"
            title={bulkMessage}
            action={
              <Button size="sm" variant="ghost" onClick={() => setBulkMessage(null)}>
                Dismiss
              </Button>
            }
          />
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
        <div className="min-w-0">
          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search tickets"
              label="Search tickets"
              className="w-full sm:w-auto sm:min-w-[160px] sm:flex-1"
            />
            <div className="w-full sm:w-36">
              <Select
                aria-label="Filter by company"
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
              >
                <option value="ALL">All companies</option>
                {companies.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-full sm:w-36">
              <Select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All statuses</option>
                {STATUS_KEYS.map((s) => (
                  <option key={s} value={s}>
                    {TICKET_STATUS[s].label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-full sm:w-36">
              <Select
                aria-label="Filter by creative"
                value={creativeFilter}
                onChange={(e) => setCreativeFilter(e.target.value)}
              >
                <option value="ALL">All creatives</option>
                <option value="__none__">Unassigned</option>
                {creatives.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.email}
                  </option>
                ))}
              </Select>
            </div>
            {filtersActive && (
              <Button variant="ghost" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>

          {/* Bulk action bar — visible only when ≥1 ticket is selected. */}
          {selectedIds.size > 0 && (
            <div
              role="region"
              aria-label="Bulk actions"
              className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--av2-accent)]/40 bg-[var(--av2-selected)] p-4"
            >
              <span className="text-sm font-semibold tabular-nums">
                {selectedIds.size} selected
              </span>
              <Button size="sm" variant="ghost" onClick={clearSelection} disabled={bulkSaving}>
                Clear
              </Button>

              <span aria-hidden className="h-6 w-px bg-[var(--av2-border)]" />

              {/* Reassign */}
              <div className="flex items-center gap-2">
                <div className="w-48">
                  <Select
                    aria-label="Reassign creative"
                    value={bulkCreativeId}
                    onChange={(e) => setBulkCreativeId(e.target.value)}
                    disabled={bulkSaving}
                  >
                    <option value="">Reassign creative…</option>
                    <option value="__none__">Unassign</option>
                    {creatives.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name ?? c.email}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  disabled={bulkCreativeId === "" || bulkSaving}
                  onClick={() =>
                    runBulk({
                      op: "reassign",
                      creativeId: bulkCreativeId === "__none__" ? null : bulkCreativeId,
                    })
                  }
                >
                  {bulkSaving ? "Applying…" : "Apply"}
                </Button>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2">
                <div className="w-40">
                  <Select
                    aria-label="Set status"
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value as TicketStatus | "")}
                    disabled={bulkSaving}
                  >
                    <option value="">Set status…</option>
                    {STATUS_KEYS.map((s) => (
                      <option key={s} value={s}>
                        {TICKET_STATUS[s].label}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  disabled={bulkStatus === "" || bulkSaving}
                  onClick={() => {
                    if (bulkStatus === "") return;
                    runBulk({ op: "status", status: bulkStatus });
                  }}
                >
                  {bulkSaving ? "Applying…" : "Apply"}
                </Button>
              </div>

              {/* Priority */}
              <div className="flex items-center gap-2">
                <div className="w-40">
                  <Select
                    aria-label="Set priority"
                    value={bulkPriority}
                    onChange={(e) => setBulkPriority(e.target.value as TicketPriority | "")}
                    disabled={bulkSaving}
                  >
                    <option value="">Set priority…</option>
                    {PRIORITY_KEYS.map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY[p].label}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  disabled={bulkPriority === "" || bulkSaving}
                  onClick={() => {
                    if (bulkPriority === "") return;
                    runBulk({ op: "priority", priority: bulkPriority });
                  }}
                >
                  {bulkSaving ? "Applying…" : "Apply"}
                </Button>
              </div>
            </div>
          )}

          {/* Table */}
          <Card padding="none">
            <Table label="Tickets">
              <thead>
                <tr>
                  <Th className="w-12">
                    <input
                      type="checkbox"
                      aria-label="Select all visible tickets"
                      checked={allVisibleSelected}
                      disabled={visibleTickets.length === 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(
                            (prev) => new Set([...prev, ...visibleTickets.map((t) => t.id)]),
                          );
                        } else {
                          clearSelection();
                        }
                      }}
                      className={CHECKBOX}
                    />
                  </Th>
                  <Th>Ticket</Th>
                  <Th>Status</Th>
                  <Th align="right">Cost</Th>
                  <Th align="right">Payout</Th>
                  <Th>Creative</Th>
                  <Th className="w-10 !pl-0">
                    <span className="sr-only">Open</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {loading && tickets.length === 0 ? (
                  [0, 1, 2, 3, 4].map((i) => (
                    <tr key={i} className="border-b border-[var(--av2-border)] last:border-b-0">
                      <td colSpan={7} className="px-6 py-4">
                        <Skeleton className="h-10" />
                      </td>
                    </tr>
                  ))
                ) : visibleTickets.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      {tickets.length === 0 ? (
                        <EmptyState
                          icon={<IconTicket width={28} height={28} />}
                          title="No tickets yet"
                          description="Once tickets are created, they will appear here for creative assignment."
                        />
                      ) : (
                        <EmptyState
                          title="No tickets match these filters"
                          description="Try a different search, or clear the filters to see every ticket."
                          action={<Button onClick={clearFilters}>Clear filters</Button>}
                        />
                      )}
                    </td>
                  </tr>
                ) : (
                  visibleTickets.map((t) => {
                    const effectiveCost = getEffectiveCost(t);
                    const effectivePayout = getEffectivePayout(t);
                    const payoutExceeds =
                      effectiveCost != null &&
                      effectivePayout != null &&
                      effectivePayout > effectiveCost;
                    const status = TICKET_STATUS[t.status];
                    const code = buildTicketCode({
                      projectCode: t.project?.code,
                      companyTicketNumber: t.companyTicketNumber ?? null,
                      ticketId: t.id,
                    });
                    const creativeLabel = t.creative ? t.creative.name || t.creative.email : null;

                    return (
                      <Tr
                        key={t.id}
                        selected={t.id === activeTicketId}
                        onSelect={() => openTicket(t.id)}
                        label={`Manage ticket ${t.title}`}
                      >
                        <Td>
                          <input
                            type="checkbox"
                            aria-label={`Select ticket ${t.title}`}
                            checked={selectedIds.has(t.id)}
                            onChange={() => toggleSelected(t.id)}
                            onClick={(e) => e.stopPropagation()}
                            className={CHECKBOX}
                          />
                        </Td>
                        <Td className="min-w-[180px]">
                          <p className="line-clamp-2 font-semibold">{t.title}</p>
                          <p className="mt-0.5 text-xs text-[var(--av2-text-2)]">
                            {t.company?.name ?? DASH}
                            <span aria-hidden> · </span>
                            <span className="tabular-nums">{code}</span>
                          </p>
                        </Td>
                        <Td>
                          {status ? (
                            <Badge tone={status.tone} dot>
                              {status.label}
                            </Badge>
                          ) : (
                            t.status
                          )}
                        </Td>
                        <Td align="right">
                          <span className="block font-medium">{fmt(effectiveCost)}</span>
                          {t.tokenCostOverride != null && (
                            <Badge tone="amber" className="mt-1">
                              Custom
                            </Badge>
                          )}
                        </Td>
                        <Td align="right">
                          <span className="flex items-center justify-end gap-1.5 font-medium">
                            {payoutExceeds && <IconWarning label="Payout exceeds ticket cost" />}
                            {fmt(effectivePayout)}
                          </span>
                          {t.creativePayoutOverride != null && (
                            <Badge tone="amber" className="mt-1">
                              Custom
                            </Badge>
                          )}
                        </Td>
                        <Td className="min-w-[120px]">
                          {creativeLabel ? (
                            <span className="line-clamp-2 break-words">{creativeLabel}</span>
                          ) : (
                            <span className="text-[var(--av2-text-2)]">Unassigned</span>
                          )}
                        </Td>
                        <Td className="!pl-0 text-[var(--av2-text-2)]">
                          <IconChevronRight />
                        </Td>
                      </Tr>
                    );
                  })
                )}
              </tbody>
            </Table>
            {tickets.length > 0 && (
              <TableFooter>
                <div>
                  <p className="text-[var(--av2-text)]">
                    Showing <span className="tabular-nums">{visibleTickets.length}</span> of{" "}
                    <span className="tabular-nums">{tickets.length}</span>{" "}
                    {plural(tickets.length, "ticket", "tickets")}
                  </p>
                  <p className="mt-0.5">
                    Select tickets to reassign, change status or priority in bulk.
                  </p>
                </div>
              </TableFooter>
            )}
          </Card>
        </div>

        {panel}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Manage ticket panel
// -----------------------------------------------------------------------------

function ManageTicketPanel({
  ticket: t,
  creatives,
  tab,
  onTab,
  onClose,
  saving,
  overrideDraft,
  onOverrideChange,
  onDiscardOverrides,
  onApplyOverrides,
  assignDraft,
  onAssignChange,
  onDiscardAssign,
  onApplyAssign,
  error,
  formatDateTime,
}: {
  ticket: AdminTicket;
  creatives: AdminCreative[];
  tab: PanelTab;
  onTab: (t: PanelTab) => void;
  onClose: () => void;
  saving: boolean;
  overrideDraft: OverrideDraft | null;
  onOverrideChange: (patch: Partial<OverrideDraft>) => void;
  onDiscardOverrides: () => void;
  onApplyOverrides: () => void;
  assignDraft: string;
  onAssignChange: (v: string) => void;
  onDiscardAssign: () => void;
  onApplyAssign: (v: string) => void;
  error: string | null;
  formatDateTime: (iso: string) => string;
}) {
  const status = TICKET_STATUS[t.status];
  const qty = t.quantity ?? 1;
  const defaultCost = t.jobType ? t.jobType.tokenCost * qty : null;
  const defaultPayout = t.jobType ? t.jobType.creativePayoutTokens * qty : null;

  const base = initialDraft(t);
  const draft = overrideDraft ?? base;
  const pricingDirty =
    overrideDraft != null &&
    (overrideDraft.costOverride.trim() !== base.costOverride ||
      overrideDraft.payoutOverride.trim() !== base.payoutOverride);
  const assignDirty = assignDraft !== (t.creative?.id ?? "");

  // Effective values implied by the current draft (empty = job-type default)
  const parse = (v: string, fallback: number | null) => {
    const s = v.trim();
    if (s === "") return fallback;
    const n = parseInt(s, 10);
    return Number.isNaN(n) ? null : n;
  };
  const draftCost = parse(draft.costOverride, defaultCost);
  const draftPayout = parse(draft.payoutOverride, defaultPayout);
  const payoutExceeds = draftCost != null && draftPayout != null && draftPayout > draftCost;
  const hasAnyOverride = draft.costOverride.trim() !== "" || draft.payoutOverride.trim() !== "";

  const currentCreative = t.creative ? t.creative.name || t.creative.email : null;

  const jobDetails = (
    <PanelSection title="Job details">
      <KeyValueList
        rows={[
          { label: "Job type", value: t.jobType?.name ?? DASH },
          { label: "Quantity", value: <span className="tabular-nums">×{qty}</span> },
          {
            label: "Default cost",
            value: <span className="tabular-nums">{fmt(defaultCost)} tokens</span>,
          },
          {
            label: "Default payout",
            value: <span className="tabular-nums">{fmt(defaultPayout)} tokens</span>,
          },
          { label: "Creative", value: currentCreative ?? "Unassigned" },
          { label: "Project", value: t.project?.name ?? DASH },
          { label: "Created", value: formatDateTime(t.createdAt) },
        ]}
      />
    </PanelSection>
  );

  const footer =
    tab === "assignment" ? (
      <SaveBar dirty={assignDirty} status={saving ? "Saving…" : undefined}>
        {assignDirty && (
          <Button variant="ghost" onClick={onDiscardAssign} disabled={saving}>
            Discard
          </Button>
        )}
        <Button
          variant="primary"
          disabled={!assignDirty || saving}
          onClick={() => onApplyAssign(assignDraft)}
        >
          {saving ? "Saving…" : "Apply assignment"}
        </Button>
      </SaveBar>
    ) : t.jobType ? (
      <SaveBar dirty={pricingDirty} status={saving ? "Saving…" : undefined}>
        {pricingDirty && (
          <Button variant="ghost" onClick={onDiscardOverrides} disabled={saving}>
            Discard
          </Button>
        )}
        <Button variant="primary" disabled={!pricingDirty || saving} onClick={onApplyOverrides}>
          {saving ? "Saving…" : "Apply pricing"}
        </Button>
      </SaveBar>
    ) : null;

  return (
    <DetailPanel title="Manage ticket" onClose={onClose} footer={footer}>
      <div className="mb-5">
        <h3 className="text-2xl leading-8 font-bold break-words">{t.title}</h3>
        <p className="mt-0.5 text-base text-[var(--av2-text-2)]">{t.company?.name ?? DASH}</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          {status ? (
            <Badge tone={status.tone} dot>
              {status.label}
            </Badge>
          ) : (
            <span className="text-sm">{t.status}</span>
          )}
          <TextLink href={`/admin/tickets/${t.id}`}>Open full ticket</TextLink>
        </div>
      </div>

      <Tabs
        label="Manage ticket sections"
        idPrefix={PANEL_ID}
        value={tab}
        onChange={onTab}
        tabs={[
          {
            value: "assignment",
            label: (
              <span className="inline-flex items-center gap-1.5">
                Assignment
                {assignDirty && (
                  <span
                    aria-label="unsaved"
                    className="h-1.5 w-1.5 rounded-full bg-[var(--av2-accent)]"
                  />
                )}
              </span>
            ),
          },
          {
            value: "pricing",
            label: (
              <span className="inline-flex items-center gap-1.5">
                Pricing
                {pricingDirty && (
                  <span
                    aria-label="unsaved"
                    className="h-1.5 w-1.5 rounded-full bg-[var(--av2-accent)]"
                  />
                )}
              </span>
            ),
          },
        ]}
      />

      {error && (
        <div className="mt-5">
          <Callout tone="error" title="Something went wrong">
            {error}
          </Callout>
        </div>
      )}

      {tab === "assignment" ? (
        <TabPanel idPrefix={PANEL_ID} value="assignment">
          <div className="pt-5">
            <PanelSection title="Creative">
              <Field
                label="Assigned creative"
                htmlFor="manage-ticket-creative"
                hint={
                  assignDirty
                    ? `Currently ${currentCreative ?? "unassigned"}. Apply to save the change.`
                    : "Choose who works on this ticket."
                }
              >
                <Select
                  id="manage-ticket-creative"
                  value={assignDraft}
                  disabled={saving}
                  onChange={(e) => onAssignChange(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {creatives.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name || d.email}
                    </option>
                  ))}
                </Select>
              </Field>
            </PanelSection>
            {jobDetails}
          </div>
        </TabPanel>
      ) : (
        <TabPanel idPrefix={PANEL_ID} value="pricing">
          <div className="pt-5">
            {t.jobType ? (
              <PanelSection title="Token pricing">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Ticket cost"
                    htmlFor="manage-ticket-cost"
                    hint={
                      draft.costOverride.trim() === ""
                        ? `Job-type default (${fmt(defaultCost)})`
                        : undefined
                    }
                  >
                    <TextInput
                      id="manage-ticket-cost"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={TOKEN_OVERRIDE_MAX}
                      step={1}
                      className="tabular-nums"
                      suffix="tokens"
                      placeholder={String(defaultCost ?? "")}
                      value={draft.costOverride}
                      disabled={saving}
                      onChange={(e) => onOverrideChange({ costOverride: e.target.value })}
                    />
                    {draft.costOverride.trim() !== "" && (
                      <Badge tone="amber" className="mt-2">
                        Custom override
                      </Badge>
                    )}
                  </Field>
                  <Field
                    label="Creative payout"
                    htmlFor="manage-ticket-payout"
                    hint={
                      draft.payoutOverride.trim() === ""
                        ? `Job-type default (${fmt(defaultPayout)})`
                        : undefined
                    }
                  >
                    <TextInput
                      id="manage-ticket-payout"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={TOKEN_OVERRIDE_MAX}
                      step={1}
                      className="tabular-nums"
                      suffix="tokens"
                      placeholder={String(defaultPayout ?? "")}
                      value={draft.payoutOverride}
                      disabled={saving}
                      onChange={(e) => onOverrideChange({ payoutOverride: e.target.value })}
                    />
                    {draft.payoutOverride.trim() !== "" && (
                      <Badge tone="amber" className="mt-2">
                        Custom override
                      </Badge>
                    )}
                  </Field>
                </div>

                {payoutExceeds && (
                  <div className="mt-4">
                    <Callout tone="warning" title="Payout exceeds ticket cost">
                      The creative would earn {fmt(draftPayout)} tokens on a {fmt(draftCost)}
                      -token ticket. Review this amount before applying further changes.
                    </Callout>
                  </div>
                )}

                {hasAnyOverride && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => onOverrideChange({ costOverride: "", payoutOverride: "" })}
                    className="mt-4 rounded text-sm font-semibold text-[var(--av2-link)] underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none disabled:opacity-50"
                  >
                    Reset to job-type defaults
                  </button>
                )}
                <p className="mt-3 text-xs text-[var(--av2-text-2)]">
                  Leave a field empty to use the job-type default. Changing the cost debits or
                  credits the company immediately.
                </p>
              </PanelSection>
            ) : (
              <PanelSection>
                <Callout title="No job type">
                  This ticket has no job type, so there is no token pricing to override.
                </Callout>
              </PanelSection>
            )}
            {jobDetails}
          </div>
        </TabPanel>
      )}
    </DetailPanel>
  );
}
