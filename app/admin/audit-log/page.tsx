// -----------------------------------------------------------------------------
// @file: app/admin/audit-log/page.tsx
// @purpose: SITE_OWNER-only read-only view of the admin action audit log.
//           Filter strip + server-paginated table on the left; the selected
//           entry's full record (actor, target, metadata JSON, IP, agent) in
//           the side panel. With nothing selected the panel explains what an
//           entry records and that rows are append-only. Forensic
//           infrastructure, not a workflow tool: nothing here mutates.
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-11-01
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { useToast } from "@/components/ui/toast-provider";
import { OwnerOnlyBanner } from "@/components/admin/owner-only-banner";
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
  PageHeader,
  Pager,
  PanelSection,
  Select,
  Skeleton,
  SplitView,
  Table,
  TableFooter,
  Td,
  Th,
  Tr,
  fmt,
  plural,
  type Tone,
} from "@/components/admin/v2/ui";
import { IconClock, IconDocument } from "@/components/admin/v2/icons";

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

const OUTCOME: Record<LogEntry["outcome"], { label: string; tone: Tone }> = {
  SUCCESS: { label: "Success", tone: "green" },
  BLOCKED: { label: "Blocked", tone: "amber" },
  ERROR: { label: "Error", tone: "red" },
};

const PAGE_SIZE = 50;

// -----------------------------------------------------------------------------
// Page-local glyphs (same 24px / 1.75 stroke family as v2/icons)
// -----------------------------------------------------------------------------

const glyph = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const IconLock = ({ size = 20 }: { size?: number }) => (
  <svg {...glyph} width={size} height={size}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
const IconUser = () => (
  <svg {...glyph}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);
const IconTarget = () => (
  <svg {...glyph}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1" />
  </svg>
);
const IconCheckCircle = () => (
  <svg {...glyph}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12 2.5 2.5 4.5-5" />
  </svg>
);
const IconRefresh = () => (
  <svg {...glyph} width={18} height={18}>
    <path d="M20 11a8 8 0 0 0-14.9-3.5M4 4v4h4" />
    <path d="M4 13a8 8 0 0 0 14.9 3.5M20 20v-4h-4" />
  </svg>
);

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

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

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

const renderMetadata = (meta: unknown): string | null => {
  if (meta == null) return null;
  try {
    return JSON.stringify(meta, null, 2);
  } catch {
    return null;
  }
};

const ENTRY_FIELDS: { icon: ReactNode; tone: Tone; title: string; body: string }[] = [
  { icon: <IconUser />, tone: "lavender", title: "Actor", body: "Who performed the action" },
  {
    icon: <IconDocument />,
    tone: "peach",
    title: "Action",
    body: "What was changed or attempted — payouts, plans, token grants, roles, pricing",
  },
  { icon: <IconTarget />, tone: "green", title: "Target", body: "The affected record" },
  {
    icon: <IconCheckCircle />,
    tone: "lavender",
    title: "Outcome",
    body: "Success, blocked by a permission check, or failed with an error",
  },
  {
    icon: <IconClock />,
    tone: "peach",
    title: "Recorded time",
    body: "When it happened, with the IP address and user agent",
  },
];

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

export default function AdminAuditLogPage() {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [actionFilter, setActionFilter] = useState<string>("");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("");

  const fetchLog = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      setError(null);
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
        setLoaded(true);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load audit log.";
        setError(message);
        showToast({ type: "error", title: message });
      } finally {
        setLoading(false);
      }
    },
    [actionFilter, outcomeFilter, showToast],
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

  const selected = entries.find((e) => e.id === selectedId) ?? null;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ---------------------------------------------------------------------------
  // Side panel: selected entry, or the "what gets logged" explainer
  // ---------------------------------------------------------------------------

  const metadataJson = selected ? renderMetadata(selected.metadata) : null;

  const panel = selected ? (
    <DetailPanel title="Entry details" onClose={() => setSelectedId(null)}>
      <PanelSection>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={OUTCOME[selected.outcome].tone} dot>
            {OUTCOME[selected.outcome].label}
          </Badge>
          <Badge tone="neutral" icon={<IconLock size={12} />}>
            Read-only
          </Badge>
        </div>
        <p className="mt-3 text-lg leading-7 font-semibold">
          {ACTION_LABELS[selected.action] ?? selected.action}
        </p>
        <p className="mt-0.5 font-mono text-xs text-[var(--av2-text-2)]">{selected.action}</p>
        <p className="mt-2 text-sm text-[var(--av2-text-2)]">{formatWhen(selected.createdAt)}</p>
      </PanelSection>

      {selected.errorMessage && (
        <PanelSection>
          <Callout
            tone={selected.outcome === "BLOCKED" ? "warning" : "error"}
            title="Error message"
          >
            {selected.errorMessage}
          </Callout>
        </PanelSection>
      )}

      <PanelSection title="Actor">
        <KeyValueList
          rows={[
            { label: "Name", value: selected.actor.name ?? DASH },
            { label: "Email", value: selected.actor.email },
            { label: "Role at the time", value: selected.actor.role },
            {
              label: "User ID",
              value: <span className="font-mono text-xs">{selected.actor.id}</span>,
            },
          ]}
        />
      </PanelSection>

      <PanelSection title="Target">
        {selected.target ? (
          <KeyValueList
            rows={[
              { label: "Type", value: selected.target.type },
              {
                label: "ID",
                value: <span className="font-mono text-xs">{selected.target.id}</span>,
              },
            ]}
          />
        ) : (
          <p className="text-sm text-[var(--av2-text-2)]">No target recorded for this action.</p>
        )}
      </PanelSection>

      <PanelSection title="Metadata">
        {metadataJson ? (
          <pre className="max-h-72 overflow-auto rounded-lg border border-[var(--av2-border)] bg-[var(--av2-bg)] p-3 font-mono text-xs leading-5 whitespace-pre-wrap text-[var(--av2-text)]">
            {metadataJson}
          </pre>
        ) : (
          <p className="text-sm text-[var(--av2-text-2)]">No metadata recorded.</p>
        )}
      </PanelSection>

      <PanelSection title="Request">
        <KeyValueList
          rows={[
            {
              label: "IP address",
              value: <span className="font-mono text-xs">{selected.ipAddress ?? DASH}</span>,
            },
            {
              label: "User agent",
              value: <span className="text-xs">{selected.userAgent ?? DASH}</span>,
            },
            {
              label: "Entry ID",
              value: <span className="font-mono text-xs">{selected.id}</span>,
            },
          ]}
        />
      </PanelSection>
    </DetailPanel>
  ) : (
    <Card as="div" className="xl:sticky xl:top-24">
      <CardTitle>What an entry shows</CardTitle>
      <ul className="mt-5 space-y-4">
        {ENTRY_FIELDS.map((f) => (
          <li key={f.title} className="flex items-start gap-4">
            <IconTile tone={f.tone} size={44} round>
              {f.icon}
            </IconTile>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-semibold">{f.title}</p>
              <p className="text-sm text-[var(--av2-text-2)]">{f.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex items-start gap-4 border-t border-[var(--av2-border)] pt-5">
        <IconTile tone="neutral" size={44} round>
          <IconLock />
        </IconTile>
        <div className="min-w-0 pt-0.5">
          <p className="text-sm font-semibold">Read-only history</p>
          <p className="text-sm text-[var(--av2-text-2)]">
            Rows are append-only. Recorded entries are never edited or deleted, including blocked
            attempts.
          </p>
        </div>
      </div>
    </Card>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // With the side panel open the list column is narrow; drop the target column
  // until 2xl (the panel shows the full target anyway).
  const targetCol = selected ? "hidden 2xl:table-cell" : "";

  const showSkeleton = loading && (!loaded || entries.length === 0);

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            Audit log
            <Badge tone="neutral" icon={<IconLock size={14} />} className="tracking-normal">
              Read-only · rows never change
            </Badge>
          </span>
        }
        description="A read-only forensic record of every privileged admin action."
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

      <Card padding="sm" className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Action" htmlFor="action-filter" className="w-full sm:w-64">
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
          <Field label="Outcome" htmlFor="outcome-filter" className="w-full sm:w-48">
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

      <SplitView panel={panel}>
        <Card padding="none">
          {showSkeleton ? (
            <div className="space-y-3 px-6 py-5" role="status">
              <span className="sr-only">Loading audit log…</span>
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
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
                description="Privileged admin actions — payouts, plan and pricing edits, token grants, role changes, hard deletes — are recorded here as they happen, including blocked attempts. Entries are append-only and can't be edited or removed."
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
              <div aria-busy={loading} className={loading ? "opacity-60" : undefined}>
                <Table label="Audit log entries">
                  <thead>
                    <tr>
                      <Th>When</Th>
                      <Th>Actor</Th>
                      <Th>Action</Th>
                      <Th>Outcome</Th>
                      <Th className={targetCol}>Target</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <Tr
                        key={e.id}
                        selected={e.id === selectedId}
                        onSelect={() => setSelectedId(e.id)}
                        label={`${ACTION_LABELS[e.action] ?? e.action} by ${e.actor.email}, ${OUTCOME[e.outcome].label}`}
                      >
                        <Td className="text-xs whitespace-nowrap text-[var(--av2-text-2)] tabular-nums">
                          <div className="text-sm text-[var(--av2-text)]">
                            {formatDay(e.createdAt)}
                          </div>
                          <div>{formatTime(e.createdAt)}</div>
                        </Td>
                        <Td>
                          <div className="font-semibold">{e.actor.name ?? e.actor.email}</div>
                          <div className="text-xs text-[var(--av2-text-2)]">
                            {e.actor.email} · {e.actor.role}
                          </div>
                        </Td>
                        <Td>
                          <div>{ACTION_LABELS[e.action] ?? e.action}</div>
                          {e.errorMessage && (
                            <div className="mt-0.5 line-clamp-1 text-xs text-[var(--av2-error-text)]">
                              {e.errorMessage}
                            </div>
                          )}
                        </Td>
                        <Td>
                          <Badge tone={OUTCOME[e.outcome].tone} dot>
                            {OUTCOME[e.outcome].label}
                          </Badge>
                        </Td>
                        <Td
                          className={`font-mono text-xs whitespace-nowrap text-[var(--av2-text-2)] ${targetCol}`}
                        >
                          {e.target ? `${e.target.type} ${e.target.id.slice(0, 8)}…` : DASH}
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
                <Pager
                  page={page}
                  pageCount={pageCount}
                  onPage={(p) => void fetchLog(Math.max(0, (p - 1) * PAGE_SIZE))}
                />
              </TableFooter>
            </>
          )}
        </Card>
      </SplitView>
    </>
  );
}
