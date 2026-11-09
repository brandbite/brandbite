// -----------------------------------------------------------------------------
// @file: app/admin/audit-log/page.tsx
// @purpose: SITE_OWNER-only read-only view of the admin action audit log.
//           Filters, then a full-width server-paginated table; "View details"
//           opens the entry's full record in a dialog, and "About audit log"
//           explains what an entry records. Forensic infrastructure, not a
//           workflow tool: nothing here mutates.
// @version: v3.0.0
// @status: active
// @lastUpdate: 2026-11-09
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { OwnerOnlyBanner } from "@/components/admin/owner-only-banner";
import {
  AboutAuditLogDialog,
  AuditEntryDialog,
  IconInfo,
  OutcomeBadge,
  ReadOnlyBadge,
} from "@/components/admin/audit-log/audit-dialogs";
import {
  ACTION_LABELS,
  actionLabel,
  formatDay,
  formatTime,
  roleLabel,
  targetLabel,
  type AuditEntry,
} from "@/components/admin/audit-log/audit-format";
import { IconArrowLeft, IconArrowRight, IconDocument } from "@/components/admin/v2/icons";
import {
  Button,
  Callout,
  Card,
  DASH,
  EmptyState,
  Field,
  PageHeader,
  Select,
  Skeleton,
  Table,
  TableFooter,
  Td,
  Th,
  Tr,
  fmt,
  plural,
} from "@/components/admin/v2/ui";
import {
  IconAiSettings,
  IconCatalog,
  IconCompanies,
  IconConsultations,
  IconFinance,
  IconPeople,
  IconSettings,
  IconWithdrawals,
} from "@/components/navigation/nav-icons";
import { useToast } from "@/components/ui/toast-provider";

type Response = {
  entries: AuditEntry[];
  pagination: { total: number; limit: number; offset: number; hasMore: boolean };
};

const PAGE_SIZES = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

const T = { width: 18, height: 18 };
const TARGET_ICONS: Record<string, ReactNode> = {
  AiToolConfig: <IconAiSettings {...T} />,
  AppSetting: <IconSettings {...T} />,
  Company: <IconCompanies {...T} />,
  ConsultationSettings: <IconConsultations {...T} />,
  PayoutRule: <IconFinance {...T} />,
  Plan: <IconCatalog {...T} />,
  TalentApplication: <IconPeople {...T} />,
  Ticket: <IconDocument {...T} />,
  UserAccount: <IconPeople {...T} />,
  Withdrawal: <IconWithdrawals {...T} />,
};

function TargetChip({ type }: { type: string }) {
  return (
    <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--av2-bg)] px-3 text-sm whitespace-nowrap">
      <span className="text-[var(--av2-text-2)]">
        {TARGET_ICONS[type] ?? <IconDocument {...T} />}
      </span>
      {targetLabel(type)}
    </span>
  );
}

const IconRefresh = () => (
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
    <path d="M20 11a8 8 0 0 0-14.9-3.5M4 4v4h4" />
    <path d="M4 13a8 8 0 0 0 14.9 3.5M20 20v-4h-4" />
  </svg>
);

export default function AdminAuditLogPage() {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openEntry, setOpenEntry] = useState<AuditEntry | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);

  const [actionFilter, setActionFilter] = useState<string>("");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("");

  const fetchLog = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("limit", String(pageSize));
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
        setLoaded(true);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load audit log.";
        setError(message);
        showToast({ type: "error", title: message });
      } finally {
        setLoading(false);
      }
    },
    [actionFilter, outcomeFilter, pageSize, showToast],
  );

  useEffect(() => {
    void fetchLog(0);
  }, [fetchLog]);

  const actionOptions = useMemo(
    () => [
      { value: "", label: "All actions" },
      ...Object.entries(ACTION_LABELS).map(([v, l]) => ({ value: v, label: l })),
    ],
    [],
  );

  const filtersActive = actionFilter !== "" || outcomeFilter !== "";
  const clearFilters = () => {
    setActionFilter("");
    setOutcomeFilter("");
  };

  const page = Math.floor(offset / pageSize) + 1;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const goToPage = (p: number) => void fetchLog(Math.max(0, (p - 1) * pageSize));

  const showSkeleton = loading && (!loaded || entries.length === 0);

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            Audit log
            <ReadOnlyBadge />
          </span>
        }
        description="A read-only record of privileged admin actions."
        actions={
          <Button onClick={() => setAboutOpen(true)}>
            <IconInfo />
            About audit log
          </Button>
        }
      />

      <OwnerOnlyBanner action="read the audit log" />

      {error && (
        <div className="mb-6">
          <Callout
            tone="error"
            title="Couldn't load the audit log"
            action={
              <Button size="sm" onClick={() => void fetchLog(offset)}>
                Try again
              </Button>
            }
          >
            {error}
          </Callout>
        </div>
      )}

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Action" htmlFor="action-filter" className="w-full sm:w-72">
            <Select
              id="action-filter"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              {actionOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Outcome" htmlFor="outcome-filter" className="w-full sm:w-60">
            <Select
              id="outcome-filter"
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
            >
              <option value="">All outcomes</option>
              <option value="SUCCESS">Success</option>
              <option value="BLOCKED">Blocked</option>
              <option value="ERROR">Error</option>
            </Select>
          </Field>
          <Button onClick={clearFilters} disabled={!filtersActive}>
            Clear filters
          </Button>
          <p className="ml-auto self-center text-sm text-[var(--av2-text-2)] tabular-nums">
            {loaded ? (
              <>
                {fmt(total)} {filtersActive ? "matching" : "recorded"}{" "}
                {plural(total, "entry", "entries")}
              </>
            ) : (
              DASH
            )}
          </p>
        </div>
      </Card>

      <Card padding="none">
        {showSkeleton ? (
          <div className="space-y-3 px-6 py-5" role="status">
            <span className="sr-only">Loading audit log…</span>
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          !loaded ? (
            <EmptyState
              icon={<IconDocument width={28} height={28} />}
              title="Audit log unavailable"
              description="The log couldn't be loaded. Try again in a moment."
            />
          ) : filtersActive ? (
            <EmptyState
              title="No entries match these filters"
              description="Nothing was recorded for this action and outcome combination. Try a different filter."
              action={<Button onClick={clearFilters}>Clear filters</Button>}
            />
          ) : (
            <EmptyState
              icon={<IconDocument width={28} height={28} />}
              title="No audit entries yet"
              description="Privileged admin actions (payouts, plan and pricing edits, token grants, role changes, hard deletes) are recorded here as they happen, including blocked attempts. Entries are append-only and can't be edited or removed."
              action={
                <Button onClick={() => void fetchLog(0)} disabled={loading}>
                  <IconRefresh />
                  Refresh
                </Button>
              }
            />
          )
        ) : (
          <>
            {/* Narrow screens: one card per entry, so nothing scrolls sideways. */}
            <ul
              aria-label="Audit log entries"
              aria-busy={loading}
              className={`divide-y divide-[var(--av2-border)] lg:hidden ${loading ? "opacity-60" : ""}`}
            >
              {entries.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setOpenEntry(e)}
                    aria-label={`View details: ${actionLabel(e.action)}, ${formatDay(e.createdAt)} ${formatTime(e.createdAt)}`}
                    className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-[var(--av2-bg)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--av2-accent)]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <span className="text-base leading-6 font-semibold">
                          {actionLabel(e.action)}
                        </span>
                        <OutcomeBadge outcome={e.outcome} />
                      </span>
                      {e.errorMessage && (
                        <span className="mt-1 line-clamp-2 block text-xs text-[var(--av2-error-text)]">
                          {e.errorMessage}
                        </span>
                      )}
                      <span className="mt-1.5 block text-sm text-[var(--av2-text-2)]">
                        <span className="font-medium text-[var(--av2-text)]">
                          {e.actor.name ?? e.actor.email}
                        </span>{" "}
                        · {roleLabel(e.actor.role)}
                      </span>
                      <span className="mt-0.5 block text-sm text-[var(--av2-text-2)] tabular-nums">
                        {formatDay(e.createdAt)} · {formatTime(e.createdAt)}
                      </span>
                      {e.target && (
                        <span className="mt-3 block">
                          <TargetChip type={e.target.type} />
                        </span>
                      )}
                    </span>
                    <IconArrowRight className="mt-1 shrink-0 text-[var(--av2-text-2)]" />
                  </button>
                </li>
              ))}
            </ul>

            <div aria-busy={loading} className={`max-lg:hidden ${loading ? "opacity-60" : ""}`}>
              <Table label="Audit log entries">
                <thead>
                  <tr>
                    <Th>When</Th>
                    <Th>Actor</Th>
                    <Th>Action</Th>
                    <Th>Target</Th>
                    <Th>Outcome</Th>
                    <Th>Details</Th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <Tr key={e.id}>
                      <Td className="whitespace-nowrap tabular-nums">
                        <div className="text-base">{formatDay(e.createdAt)}</div>
                        <div className="text-[var(--av2-text-2)]">{formatTime(e.createdAt)}</div>
                      </Td>
                      <Td>
                        <div className="text-base font-semibold">
                          {e.actor.name ?? e.actor.email}
                        </div>
                        <div className="text-[var(--av2-text-2)]">{roleLabel(e.actor.role)}</div>
                      </Td>
                      <Td className="min-w-48">
                        <div className="text-base">{actionLabel(e.action)}</div>
                        {e.errorMessage && (
                          <div className="mt-0.5 line-clamp-1 text-xs text-[var(--av2-error-text)]">
                            {e.errorMessage}
                          </div>
                        )}
                      </Td>
                      <Td>
                        {e.target ? (
                          <TargetChip type={e.target.type} />
                        ) : (
                          <span className="text-[var(--av2-text-2)]">
                            <span aria-hidden>{DASH}</span>
                            <span className="sr-only">No target</span>
                          </span>
                        )}
                      </Td>
                      <Td>
                        <OutcomeBadge outcome={e.outcome} />
                      </Td>
                      <Td>
                        <Button
                          onClick={() => setOpenEntry(e)}
                          aria-label={`View details: ${actionLabel(e.action)}, ${formatDay(e.createdAt)} ${formatTime(e.createdAt)}`}
                        >
                          View details
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <TableFooter>
              <span className="tabular-nums">
                Showing {fmt(offset + 1)}–{fmt(Math.min(offset + entries.length, total))} of{" "}
                {fmt(total)}
              </span>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2">
                  <span className="sr-only">Entries per page</span>
                  <Select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="w-36"
                  >
                    {PAGE_SIZES.map((n) => (
                      <option key={n} value={n}>
                        {n} per page
                      </option>
                    ))}
                  </Select>
                </label>
                <div className="flex items-center gap-4">
                  <span className="tabular-nums">
                    Page {page} of {pageCount}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      aria-label="Previous page"
                      className="w-10 px-0!"
                      disabled={page <= 1 || loading}
                      onClick={() => goToPage(page - 1)}
                    >
                      <IconArrowLeft />
                    </Button>
                    <Button
                      aria-label="Next page"
                      className="w-10 px-0!"
                      disabled={page >= pageCount || loading}
                      onClick={() => goToPage(page + 1)}
                    >
                      <IconArrowRight />
                    </Button>
                  </div>
                </div>
              </div>
            </TableFooter>
          </>
        )}
      </Card>

      <AuditEntryDialog entry={openEntry} onClose={() => setOpenEntry(null)} />
      <AboutAuditLogDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </>
  );
}
