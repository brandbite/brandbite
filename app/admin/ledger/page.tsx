// -----------------------------------------------------------------------------
// @file: app/admin/ledger/page.tsx
// @purpose: Admin-facing global token ledger overview (admin design language
//           v1). Filterable, paginated movement list on the left; the full
//           entry (notes, references, metadata) opens in a detail panel.
//           Read-only — no mutations from this page.
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-11-01
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import type { UserRole } from "@prisma/client";
import { formatLedgerReason } from "@/lib/ledger-reason";
import { formatRole } from "@/lib/roles";
import {
  Badge,
  Button,
  ButtonLink,
  Callout,
  Card,
  CardTitle,
  DASH,
  DetailPanel,
  EmptyState,
  FilterBar,
  IconTile,
  KeyValueList,
  KpiCard,
  PageHeader,
  Pager,
  PanelSection,
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
import { IconCoins, IconDocument } from "@/components/admin/v2/icons";

type LedgerDirection = "CREDIT" | "DEBIT";

type AdminLedgerEntry = {
  id: string;
  createdAt: string;
  direction: LedgerDirection;
  amount: number;
  reason: string | null;
  notes: string | null;
  company: {
    id: string;
    name: string;
    slug: string;
  } | null;
  ticket: {
    id: string;
    title: string;
    code: string | null;
    projectName: string | null;
    projectCode: string | null;
  } | null;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  } | null;
  balanceBefore: number | null;
  balanceAfter: number | null;
  metadata: unknown;
};

type AdminLedgerResponse = {
  stats: {
    totalCredits: number;
    totalDebits: number;
    netTokens: number;
    entriesCount: number;
  };
  entries: AdminLedgerEntry[];
};

const PAGE_SIZE = 15;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Signed token amount: "+12", "−200" (true minus sign), "0". */
function signed(n: number | null | undefined) {
  if (typeof n !== "number" || !Number.isFinite(n)) return DASH;
  if (n > 0) return `+${fmt(n)}`;
  if (n < 0) return `−${fmt(Math.abs(n))}`;
  return "0";
}

/** Shared ledger wording ("JOB_COMPLETED" → "Request completed"), same as the CSV. */
function humanizeReason(reason: string | null) {
  if (!reason || !reason.trim()) return null;
  return formatLedgerReason(reason);
}

const roleLabel = (role: string) => formatRole(role as UserRole);

const userLabel = (u: NonNullable<AdminLedgerEntry["user"]>) => u.name || u.email;

function hasMetadata(m: unknown) {
  if (m == null) return false;
  if (typeof m === "object" && Object.keys(m as object).length === 0) return false;
  return true;
}

function IconArrow({ dir, size = 16 }: { dir: "up" | "down"; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {dir === "up" ? <path d="M12 19V5M5 12l7-7 7 7" /> : <path d="M12 5v14M19 12l-7 7-7-7" />}
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

function IconScale() {
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
      <path d="M7 7h10M7 12h10M7 17h6" />
      <rect x="3" y="3" width="18" height="18" rx="3" />
    </svg>
  );
}

function DirectionBadge({ direction }: { direction: LedgerDirection }) {
  return direction === "CREDIT" ? (
    <Badge tone="green">Credit</Badge>
  ) : (
    <Badge tone="red">Debit</Badge>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminLedgerPage() {
  const [data, setData] = useState<AdminLedgerResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [companyFilter, setCompanyFilter] = useState<string>("ALL");
  const [directionFilter, setDirectionFilter] = useState<"ALL" | LedgerDirection>("ALL");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/admin/ledger", {
          // Admin view, we always want fresh data
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          if (res.status === 401) {
            throw new Error("You must be signed in as an admin to view this page.");
          }
          if (res.status === 403) {
            throw new Error("You do not have permission to view the admin ledger.");
          }
          const msg = json?.error || `Request failed with status ${res.status}`;
          throw new Error(msg);
        }

        if (!cancelled) {
          setData(json as AdminLedgerResponse);
        }
      } catch (err: any) {
        console.error("Admin ledger fetch error:", err);
        if (!cancelled) {
          setError(err?.message || "Failed to load admin ledger.");
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

  const entries = useMemo(() => data?.entries ?? [], [data]);
  const stats = data?.stats;

  const companies = useMemo(() => {
    const list = Array.from(
      new Set(entries.map((e) => e.company?.name).filter((name): name is string => !!name)),
    );
    return list.sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (companyFilter !== "ALL" && e.company?.name !== companyFilter) {
        return false;
      }
      if (directionFilter !== "ALL" && e.direction !== directionFilter) {
        return false;
      }
      if (q) {
        const haystack = [
          e.company?.name,
          e.company?.slug,
          e.ticket?.code,
          e.ticket?.title,
          e.ticket?.projectName,
          e.reason,
          humanizeReason(e.reason),
          e.notes,
          e.user?.name,
          e.user?.email,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [entries, companyFilter, directionFilter, query]);

  // Client-side pagination over the already-fetched entries.
  const pageCount = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filteredEntries.slice(pageStart, pageStart + PAGE_SIZE);

  const filtersActive = companyFilter !== "ALL" || directionFilter !== "ALL" || query.trim() !== "";
  const resetFilters = () => {
    setCompanyFilter("ALL");
    setDirectionFilter("ALL");
    setQuery("");
    setPage(1);
  };

  const selected = entries.find((e) => e.id === selectedId) ?? null;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // ---------------------------------------------------------------------------
  // Detail panel
  // ---------------------------------------------------------------------------

  const panel = selected
    ? (() => {
        const isCredit = selected.direction === "CREDIT";
        const reason = humanizeReason(selected.reason);
        return (
          <DetailPanel
            title="Movement details"
            onClose={() => setSelectedId(null)}
            closeLabel="Close movement details"
          >
            <div className="flex items-center gap-4">
              <IconTile tone={isCredit ? "green" : "red"} size={48} round>
                <IconArrow dir={isCredit ? "up" : "down"} size={22} />
              </IconTile>
              <div className="min-w-0">
                <p className="text-2xl leading-8 font-bold tracking-tight tabular-nums">
                  {isCredit ? "+" : "−"}
                  {fmt(selected.amount)} {plural(selected.amount, "token", "tokens")}
                </p>
                <div className="mt-1">
                  <DirectionBadge direction={selected.direction} />
                </div>
              </div>
            </div>

            <div className="mt-6">
              <PanelSection>
                <KeyValueList
                  rows={[
                    {
                      label: "Company",
                      value: selected.company ? (
                        <>
                          {selected.company.name}
                          <span className="block text-xs font-normal text-[var(--av2-text-2)]">
                            {selected.company.slug}
                          </span>
                        </>
                      ) : (
                        DASH
                      ),
                    },
                    {
                      label: "Reason",
                      value: reason ? (
                        <>
                          {reason}
                          <span className="block font-mono text-xs font-normal text-[var(--av2-text-2)]">
                            {selected.reason}
                          </span>
                        </>
                      ) : (
                        DASH
                      ),
                    },
                    {
                      label: "Recorded",
                      value: (
                        <span className="tabular-nums">
                          {formatDate(selected.createdAt)} · {formatTime(selected.createdAt)}
                        </span>
                      ),
                    },
                    {
                      label: "Balance before",
                      value: (
                        <span className="tabular-nums">
                          {selected.balanceBefore != null
                            ? `${fmt(selected.balanceBefore)} tokens`
                            : DASH}
                        </span>
                      ),
                    },
                    {
                      label: "Balance after",
                      value: (
                        <span className="tabular-nums">
                          {selected.balanceAfter != null
                            ? `${fmt(selected.balanceAfter)} tokens`
                            : DASH}
                        </span>
                      ),
                    },
                  ]}
                />
              </PanelSection>

              <PanelSection title="Notes">
                {selected.notes ? (
                  <p className="text-sm break-words whitespace-pre-wrap">{selected.notes}</p>
                ) : (
                  <p className="text-sm text-[var(--av2-text-2)]">No notes recorded.</p>
                )}
              </PanelSection>

              <PanelSection title="References">
                <KeyValueList
                  rows={[
                    {
                      label: "Request",
                      value: selected.ticket ? (
                        <>
                          <span className="font-mono">{selected.ticket.code ?? DASH}</span>
                          <span className="block font-normal">{selected.ticket.title}</span>
                          {selected.ticket.projectName && (
                            <span className="block text-xs font-normal text-[var(--av2-text-2)]">
                              {selected.ticket.projectName}
                            </span>
                          )}
                          <span className="mt-2 block">
                            <TextLink href={`/admin/tickets/${selected.ticket.id}`}>
                              Open request
                            </TextLink>
                          </span>
                        </>
                      ) : (
                        <span className="font-normal text-[var(--av2-text-2)]">Not linked</span>
                      ),
                    },
                    {
                      label: "User",
                      value: selected.user ? (
                        <>
                          {userLabel(selected.user)}
                          {selected.user.name && (
                            <span className="block text-xs font-normal break-all text-[var(--av2-text-2)]">
                              {selected.user.email}
                            </span>
                          )}
                          <span className="mt-1 block">
                            <Badge>{roleLabel(selected.user.role)}</Badge>
                          </span>
                        </>
                      ) : (
                        <span className="font-normal text-[var(--av2-text-2)]">Not recorded</span>
                      ),
                    },
                  ]}
                />
              </PanelSection>

              <PanelSection title="Metadata">
                {hasMetadata(selected.metadata) ? (
                  <pre className="max-h-64 overflow-auto rounded-lg border border-[var(--av2-border)] bg-[var(--av2-bg)] p-3 font-mono text-xs leading-5 whitespace-pre-wrap">
                    {JSON.stringify(selected.metadata, null, 2)}
                  </pre>
                ) : (
                  <p className="text-sm text-[var(--av2-text-2)]">No metadata recorded.</p>
                )}
              </PanelSection>

              <PanelSection>
                <p className="text-xs text-[var(--av2-text-2)]">
                  Entry ID <span className="font-mono break-all">{selected.id}</span>
                </p>
              </PanelSection>
            </div>
          </DetailPanel>
        );
      })()
    : null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const statsHint = stats
    ? `Latest ${fmt(stats.entriesCount)} ${plural(stats.entriesCount, "entry", "entries")}`
    : "Loaded entries";

  return (
    <>
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            Token ledger
            <Badge className="align-middle">Read only</Badge>
          </span>
        }
        description="Trace company and creative token movements across the platform. Only visible to site admins."
        actions={<ButtonLink href="/admin/token-analytics">Token analytics</ButtonLink>}
      />

      {error && (
        <div className="mb-6">
          <Callout tone="error" title="Something went wrong">
            {error}
          </Callout>
        </div>
      )}

      {/* Summary cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          icon={<IconScale />}
          tone="peach"
          label="Net tokens"
          value={loading && !data ? DASH : signed(stats?.netTokens)}
          hint={`Credits minus debits · ${statsHint.toLowerCase()}`}
        />
        <KpiCard
          icon={<IconArrow dir="up" size={20} />}
          tone="green"
          label="Total credits"
          value={loading && !data ? DASH : fmt(stats?.totalCredits)}
          hint="Plans, top-ups, refunds and adjustments"
        />
        <KpiCard
          icon={<IconArrow dir="down" size={20} />}
          tone="red"
          label="Total debits"
          value={loading && !data ? DASH : fmt(stats?.totalDebits)}
          hint="Requests, withdrawals and corrections"
        />
      </div>

      <SplitView panel={panel}>
        <Card padding="none">
          <div className="px-6 pt-5">
            <div className="mb-4">
              <CardTitle
                action={
                  data ? (
                    <span className="pt-1 text-sm whitespace-nowrap text-[var(--av2-text-2)] tabular-nums">
                      {statsHint}
                    </span>
                  ) : null
                }
              >
                Recent movements
              </CardTitle>
            </div>
            <FilterBar>
              <SearchInput
                className="min-w-[220px] flex-1"
                value={query}
                onChange={(v) => {
                  setQuery(v);
                  setPage(1);
                }}
                placeholder="Search company, request, reason or note"
                label="Search movements by company, request, reason, note or user"
              />
              <div className="w-full sm:w-48">
                <Select
                  aria-label="Filter by company"
                  value={companyFilter}
                  onChange={(e) => {
                    setCompanyFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="ALL">All companies</option>
                  {companies.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="w-full sm:w-40">
                <Select
                  aria-label="Filter by direction"
                  value={directionFilter}
                  onChange={(e) => {
                    setDirectionFilter(e.target.value as "ALL" | LedgerDirection);
                    setPage(1);
                  }}
                >
                  <option value="ALL">All directions</option>
                  <option value="CREDIT">Credits</option>
                  <option value="DEBIT">Debits</option>
                </Select>
              </div>
            </FilterBar>
          </div>

          {loading && !data ? (
            <div className="space-y-3 border-t border-[var(--av2-border)] px-6 py-5" role="status">
              <span className="sr-only">Loading ledger…</span>
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="border-t border-[var(--av2-border)]">
              <EmptyState
                icon={<IconCoins width={28} height={28} />}
                title="No token movements yet"
                description="Ledger entries appear here once companies buy plans, create requests or creatives get paid."
              />
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="border-t border-[var(--av2-border)]">
              <EmptyState
                title="No movements match these filters"
                description="Try a different search, company or direction."
                action={<Button onClick={resetFilters}>Clear filters</Button>}
              />
            </div>
          ) : (
            <Table label="Token movements">
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Account</Th>
                  <Th className="w-full">Reason</Th>
                  <Th align="right">Movement</Th>
                  {!selected && <Th align="right">Balance</Th>}
                  <Th align="right">
                    <span className="sr-only">Open</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((e) => {
                  const isCredit = e.direction === "CREDIT";
                  const reason = humanizeReason(e.reason);
                  return (
                    <Tr
                      key={e.id}
                      selected={e.id === selectedId}
                      onSelect={() => setSelectedId(e.id)}
                      label={`${isCredit ? "Credit" : "Debit"} of ${fmt(e.amount)} tokens, ${
                        e.company?.name ?? "no company"
                      }, ${formatDate(e.createdAt)}`}
                    >
                      <Td className="whitespace-nowrap tabular-nums">
                        <div>{formatDate(e.createdAt)}</div>
                        <div className="text-xs text-[var(--av2-text-2)]">
                          {formatTime(e.createdAt)}
                        </div>
                      </Td>
                      <Td className="max-w-[170px]">
                        {e.company ? (
                          <>
                            <div className="truncate font-semibold">{e.company.name}</div>
                            <div className="truncate text-xs text-[var(--av2-text-2)]">
                              {e.user
                                ? `${userLabel(e.user)} · ${roleLabel(e.user.role)}`
                                : e.company.slug}
                            </div>
                          </>
                        ) : e.user ? (
                          <>
                            <div className="truncate font-semibold">{userLabel(e.user)}</div>
                            <div className="truncate text-xs text-[var(--av2-text-2)]">
                              {roleLabel(e.user.role)}
                            </div>
                          </>
                        ) : (
                          <span className="text-[var(--av2-text-2)]">{DASH}</span>
                        )}
                      </Td>
                      <Td className="w-full max-w-0 min-w-[160px]">
                        <div className="truncate">{reason ?? DASH}</div>
                        {(e.notes || e.ticket) && (
                          <div
                            className="truncate text-xs text-[var(--av2-text-2)]"
                            title={e.notes ?? undefined}
                          >
                            {e.ticket?.code && <span className="font-mono">{e.ticket.code}</span>}
                            {e.ticket?.code && e.notes && " · "}
                            {e.notes}
                          </div>
                        )}
                      </Td>
                      <Td align="right" className="whitespace-nowrap">
                        <div className="font-semibold">
                          {isCredit ? "+" : "−"}
                          {fmt(e.amount)}
                        </div>
                        <div className="inline-flex items-center gap-1 text-xs text-[var(--av2-text-2)]">
                          <IconArrow dir={isCredit ? "up" : "down"} size={12} />
                          {isCredit ? "Credit" : "Debit"}
                        </div>
                      </Td>
                      {!selected && (
                        <Td align="right" className="whitespace-nowrap">
                          {e.balanceAfter != null ? (
                            fmt(e.balanceAfter)
                          ) : (
                            <span className="text-[var(--av2-text-2)]">{DASH}</span>
                          )}
                        </Td>
                      )}
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

          {data && filteredEntries.length > 0 && (
            <TableFooter>
              <span className="tabular-nums">
                Showing {fmt(pageStart + 1)}–{fmt(pageStart + pageRows.length)} of{" "}
                {fmt(filteredEntries.length)}
                {filtersActive && ` (filtered from ${fmt(entries.length)})`}
              </span>
              <div className="flex flex-wrap items-center gap-3">
                {filtersActive && (
                  <Button size="sm" variant="ghost" onClick={resetFilters}>
                    Clear filters
                  </Button>
                )}
                <Pager page={currentPage} pageCount={pageCount} onPage={setPage} />
              </div>
            </TableFooter>
          )}
        </Card>

        {!selected && data && entries.length > 0 && (
          <p className="mt-6 flex items-center gap-2 text-sm text-[var(--av2-text-2)]">
            <IconDocument width={18} height={18} className="shrink-0" />
            Select a movement to see its full note, references and metadata.
          </p>
        )}
      </SplitView>
    </>
  );
}
