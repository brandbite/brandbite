// -----------------------------------------------------------------------------
// @file: app/admin/audit-log/page.tsx
// @purpose: SITE_OWNER-only read-only view of the admin action audit log.
//           Renders a filter strip + paginated table. Designed to be readable
//           first, actionable second — it's forensic infrastructure, not a
//           workflow tool.
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { LoadingState } from "@/components/ui/loading-state";
import { useToast } from "@/components/ui/toast-provider";
import { OwnerOnlyBanner } from "@/components/admin/owner-only-banner";

type LogEntry = {
  id: string;
  createdAt: string;
  action: string;
  outcome: "SUCCESS" | "BLOCKED" | "ERROR";
  actor: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  };
  target: { type: string; id: string } | null;
  metadata: unknown;
  errorMessage: string | null;
  ipAddress: string | null;
  userAgent: string | null;
};

type Response = {
  entries: LogEntry[];
  pagination: { total: number; limit: number; offset: number; hasMore: boolean };
};

const ACTION_LABELS: Record<string, string> = {
  WITHDRAWAL_APPROVE: "Withdrawal approved",
  WITHDRAWAL_MARK_PAID: "Withdrawal marked paid",
  WITHDRAWAL_REJECT: "Withdrawal rejected",
  PLAN_CREATE: "Plan created",
  PLAN_EDIT: "Plan edited",
  PLAN_DELETE: "Plan deleted",
  PLAN_ASSIGN: "Plan assigned",
  COMPANY_TOKEN_GRANT: "Company tokens granted/debited",
  PAYOUT_RULE_EDIT: "Payout rule edited",
  TICKET_FINANCIAL_OVERRIDE: "Ticket financial override",
  USER_PROMOTE_TO_ADMIN: "User role changed (admin)",
  USER_HARD_DELETE: "User hard-deleted",
  AI_PRICING_EDIT: "AI pricing edited",
  CONSULTATION_PRICING_EDIT: "Consultation pricing edited",
  GOOGLE_OAUTH_CONFIG_EDIT: "Google OAuth config changed",
};

const OUTCOME_BADGE: Record<LogEntry["outcome"], string> = {
  SUCCESS:
    "inline-flex items-center rounded-md bg-[var(--bb-success-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--bb-success-text)]",
  BLOCKED:
    "inline-flex items-center rounded-md bg-[var(--bb-warning-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--bb-warning-text)]",
  ERROR:
    "inline-flex items-center rounded-md bg-[var(--bb-danger-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--bb-danger-text)]",
};

const PAGE_SIZE = 50;

export default function AdminAuditLogPage() {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const [actionFilter, setActionFilter] = useState<string>("");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("");

  const fetchLog = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", String(nextOffset));
        if (actionFilter) params.set("action", actionFilter);
        if (outcomeFilter) params.set("outcome", outcomeFilter);

        const res = await fetch(`/api/admin/audit-log?${params.toString()}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as Response & { error?: string };
        if (!res.ok) throw new Error(json.error || "Failed to load audit log.");
        setEntries(json.entries);
        setTotal(json.pagination.total);
        setOffset(json.pagination.offset);
      } catch (err) {
        showToast({
          type: "error",
          title: err instanceof Error ? err.message : "Failed to load audit log.",
        });
      } finally {
        setLoading(false);
      }
    },
    [actionFilter, outcomeFilter, showToast],
  );

  useEffect(() => {
    void fetchLog(0);
  }, [fetchLog]);

  const formatWhen = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const renderMetadata = (meta: unknown): string => {
    if (meta == null) return "—";
    try {
      return JSON.stringify(meta);
    } catch {
      return "—";
    }
  };

  const actionOptions = useMemo(
    () => [
      { value: "", label: "All actions" },
      ...Object.entries(ACTION_LABELS).map(([v, l]) => ({ value: v, label: l })),
    ],
    [],
  );

  return (
    <>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
          Read-only forensic record of every privileged action. Rows never update or delete.
        </p>
      </div>

      <OwnerOnlyBanner action="read the audit log" />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-3 py-2">
        <label className="text-xs text-[var(--bb-text-tertiary)]" htmlFor="action-filter">
          Action
        </label>
        <select
          id="action-filter"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded-md border border-[var(--bb-border-input)] bg-[var(--bb-bg-page)] px-2 py-1 text-xs"
        >
          {actionOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <label className="ml-4 text-xs text-[var(--bb-text-tertiary)]" htmlFor="outcome-filter">
          Outcome
        </label>
        <select
          id="outcome-filter"
          value={outcomeFilter}
          onChange={(e) => setOutcomeFilter(e.target.value)}
          className="rounded-md border border-[var(--bb-border-input)] bg-[var(--bb-bg-page)] px-2 py-1 text-xs"
        >
          <option value="">All</option>
          <option value="SUCCESS">Success</option>
          <option value="BLOCKED">Blocked</option>
          <option value="ERROR">Error</option>
        </select>

        <div className="ml-auto text-xs text-[var(--bb-text-tertiary)]">
          {total} total {total === 1 ? "entry" : "entries"}
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading audit log..." />
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-5 py-10 text-center">
          <p className="text-sm text-[var(--bb-text-secondary)]">
            No audit entries match these filters.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] shadow-sm">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-[var(--bb-bg-warm)] text-[11px] tracking-wider text-[var(--bb-text-tertiary)] uppercase">
              <tr>
                <th className="px-3 py-2 font-semibold">When</th>
                <th className="px-3 py-2 font-semibold">Actor</th>
                <th className="px-3 py-2 font-semibold">Action</th>
                <th className="px-3 py-2 font-semibold">Outcome</th>
                <th className="px-3 py-2 font-semibold">Target</th>
                <th className="px-3 py-2 font-semibold">Details</th>
                <th className="px-3 py-2 font-semibold">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--bb-border-subtle)]">
              {entries.map((e) => (
                <tr key={e.id} className="align-top">
                  <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap text-[var(--bb-text-secondary)]">
                    {formatWhen(e.createdAt)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-[var(--bb-secondary)]">
                      {e.actor.name ?? e.actor.email}
                    </div>
                    <div className="text-[10px] text-[var(--bb-text-tertiary)]">
                      {e.actor.email} · {e.actor.role}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[var(--bb-secondary)]">
                    {ACTION_LABELS[e.action] ?? e.action}
                  </td>
                  <td className="px-3 py-2">
                    <span className={OUTCOME_BADGE[e.outcome]}>{e.outcome}</span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-[var(--bb-text-secondary)]">
                    {e.target ? `${e.target.type} ${e.target.id.slice(0, 8)}…` : "—"}
                  </td>
                  <td className="max-w-[280px] px-3 py-2">
                    <div className="font-mono text-[10px] break-words text-[var(--bb-text-secondary)]">
                      {renderMetadata(e.metadata)}
                    </div>
                    {e.errorMessage && (
                      <div className="mt-1 text-[10px] text-[var(--bb-danger-text)] italic">
                        {e.errorMessage}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-[var(--bb-text-tertiary)]">
                    {e.ipAddress ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && total > PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-between text-xs text-[var(--bb-text-tertiary)]">
          <div>
            Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => void fetchLog(Math.max(0, offset - PAGE_SIZE))}
              className="rounded-md border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-3 py-1 text-xs font-medium text-[var(--bb-text-secondary)] disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => void fetchLog(offset + PAGE_SIZE)}
              className="rounded-md border border-[var(--bb-border)] bg-[var(--bb-bg-page)] px-3 py-1 text-xs font-medium text-[var(--bb-text-secondary)] disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
}
