// -----------------------------------------------------------------------------
// @file: app/customer/tokens/page.tsx
// @purpose: Customer-facing token balance & ledger view (session-based)
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";

import { IconCoins, IconTicket } from "@/components/admin/v2/icons";
import {
  Button,
  Callout,
  Card,
  CardTitle,
  DASH,
  DetailPanel,
  EmptyState,
  Field,
  FilterChips,
  KeyValueList,
  KpiCard,
  PageHeader,
  PanelSection,
  SearchInput,
  Skeleton,
  SplitView,
  Table,
  Td,
  TextInput,
  Th,
  Tr,
} from "@/components/admin/v2/ui";
import { buildLedgerParams } from "@/components/dashboard/money/ledger-query";
import {
  DirectionBadge,
  downloadLedgerCsv,
  formatDateTime,
  formatLedgerReason,
  formatSignedTokens,
  ListFooter,
  RecordedBalance,
  TokenFigure,
  useRevealPanel,
  type LedgerDirection,
} from "@/components/dashboard/money/money-ui";
import { canManageBilling, type CompanyRole } from "@/lib/permissions/companyRoles";

const PAGE_SIZE = 6;
const SEARCH_DELAY_MS = 300;

type DirectionFilter = "ALL" | LedgerDirection;

type LedgerEntry = {
  id: string;
  createdAt: string;
  direction: LedgerDirection;
  amount: number;
  reason: string | null;
  notes: string | null;
  ticketCode: string | null;
  balanceBefore: number | null;
  balanceAfter: number | null;
};

type CustomerTokensResponse = {
  company: {
    id: string;
    name: string;
    slug: string;
    tokenBalance: number;
  };
  stats: {
    totalCredits: number;
    totalDebits: number;
  };
  ledger: LedgerEntry[];
  pagination: {
    page: number;
    pageSize: number;
    pageCount: number;
    total: number;
  };
};

function prettyCompanyRole(role: CompanyRole | null): string | null {
  switch (role) {
    case "OWNER":
      return "Owner";
    case "PM":
      return "Project manager";
    case "BILLING":
      return "Billing manager";
    case "MEMBER":
      return "Member";
    default:
      return null;
  }
}

export default function CustomerTokensPage() {
  const [data, setData] = useState<CustomerTokensResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [companyRole, setCompanyRole] = useState<CompanyRole | null>(null);

  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("ALL");
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [fromDay, setFromDay] = useState("");
  const [toDay, setToDay] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelClosed, setPanelClosed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const { ref: panelRef, reveal } = useRevealPanel();

  const rangeInvalid = Boolean(fromDay && toDay && fromDay > toDay);
  const hasFilters = Boolean(directionFilter !== "ALL" || appliedQuery.trim() || fromDay || toDay);
  const filterParams = useMemo(
    () =>
      rangeInvalid
        ? ""
        : buildLedgerParams({
            direction: directionFilter,
            fromDay,
            toDay,
            q: appliedQuery,
          }).toString(),
    [directionFilter, fromDay, toDay, appliedQuery, rangeInvalid],
  );

  // Search runs on the server, so wait for a pause in typing.
  useEffect(() => {
    const timer = setTimeout(() => setAppliedQuery(query), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    // Keep the last good rows on screen until the dates make sense again.
    if (rangeInvalid) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams(filterParams);
        params.set("page", String(page));
        params.set("pageSize", String(PAGE_SIZE));

        const res = await fetch(`/api/customer/tokens?${params}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          const msg = json?.error || `Request failed with status ${res.status}`;
          throw new Error(msg);
        }

        if (!cancelled) {
          setData(json as CustomerTokensResponse);
        }
      } catch (err: any) {
        console.error("Customer tokens fetch error:", err);
        if (!cancelled) {
          setError(err?.message || "Failed to load tokens.");
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
  }, [filterParams, page, rangeInvalid]);

  // Fetch company role in the background; failures here should not block the
  // main tokens view.
  useEffect(() => {
    let cancelled = false;

    const loadRole = async () => {
      try {
        const settingsRes = await fetch("/api/customer/settings", {
          cache: "no-store",
        });
        const settingsJson = await settingsRes.json().catch(() => null);

        if (settingsRes.ok && !cancelled) {
          const role = settingsJson?.user?.companyRole ?? null;
          if (
            role === "OWNER" ||
            role === "PM" ||
            role === "BILLING" ||
            role === "MEMBER" ||
            role === null
          ) {
            setCompanyRole(role);
          }
        }
      } catch (settingsError) {
        console.error("Customer settings fetch error (companyRole only):", settingsError);
      }
    };

    loadRole();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch(`/api/customer/tokens/export?${filterParams}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || `Request failed with status ${res.status}`);
      }
      downloadLedgerCsv(await res.blob());
    } catch (err: any) {
      console.error("Customer tokens export error:", err);
      setExportError(err?.message || "Failed to export the ledger.");
    } finally {
      setExporting(false);
    }
  };

  const company = data?.company;
  const rows = data?.ledger ?? [];
  const pagination = data?.pagination;
  const firstRow = pagination ? (pagination.page - 1) * pagination.pageSize + 1 : 0;

  // Derived from the visible rows, so the panel and the highlighted row always agree.
  const selected = panelClosed ? null : (rows.find((e) => e.id === selectedId) ?? rows[0] ?? null);

  const roleLabel = prettyCompanyRole(companyRole);

  return (
    <>
      <PageHeader
        title="Tokens overview"
        description="Your company's token balance and recent usage across creative requests."
        meta={
          company ? (
            <>
              Company <span className="font-medium text-[var(--av2-text)]">{company.name}</span>
              {roleLabel ? (
                <>
                  {" · "}You are browsing as{" "}
                  <span className="font-medium text-[var(--av2-text)]">{roleLabel}</span>
                </>
              ) : null}
            </>
          ) : null
        }
      />

      <div className="space-y-6">
        {/* Limited access info for non-billing roles */}
        {!error && companyRole && !canManageBilling(companyRole) ? (
          <Callout tone="warning" title="Limited access">
            You can see your company&apos;s token balance and history, but only the owner or billing
            manager can request top-ups or billing changes.
          </Callout>
        ) : null}

        {error ? (
          <Callout tone="error" title="We couldn't load your tokens">
            {error}
          </Callout>
        ) : null}

        {exportError ? (
          <Callout tone="error" title="We couldn't export your ledger">
            {exportError}
          </Callout>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-3">
          <KpiCard
            icon={<IconCoins />}
            tone="green"
            label="Current balance"
            value={data ? <TokenFigure value={data.company.tokenBalance} /> : DASH}
            hint="Your company's current token balance."
          />
          <KpiCard
            icon={<IconTicket />}
            tone="lavender"
            label="All-time credits"
            value={data ? <TokenFigure value={data.stats.totalCredits} unit={false} /> : DASH}
            hint="Every plan renewal, top-up and adjustment. Filters don't change this."
          />
          <KpiCard
            icon={<IconTicket />}
            tone="peach"
            label="All-time debits"
            value={data ? <TokenFigure value={data.stats.totalDebits} unit={false} /> : DASH}
            hint="All request work and other debits. Filters don't change this."
          />
        </div>

        {!data ? (
          error ? null : (
            <div aria-busy="true" aria-label="Loading token ledger">
              <Skeleton className="h-96" />
            </div>
          )
        ) : (
          <SplitView
            panel={
              selected ? (
                <div ref={panelRef} className="scroll-mt-20 xl:contents">
                  <LedgerDetail entry={selected} onClose={() => setPanelClosed(true)} />
                </div>
              ) : null
            }
          >
            <Card padding="none">
              <div className="px-6 pt-6">
                <CardTitle description="A chronological view of how tokens have moved in or out of your balance.">
                  Token ledger
                </CardTitle>
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <FilterChips
                    label="Filter by type"
                    options={[
                      { value: "ALL", label: "All" },
                      { value: "CREDIT", label: "Credits" },
                      { value: "DEBIT", label: "Debits" },
                    ]}
                    value={directionFilter}
                    onChange={(v: DirectionFilter) => {
                      setDirectionFilter(v);
                      setPage(1);
                    }}
                  />
                  <SearchInput
                    className="min-w-[200px] flex-1"
                    value={query}
                    onChange={(v) => {
                      setQuery(v);
                      setPage(1);
                    }}
                    placeholder="Search ledger"
                    label="Search ledger"
                  />
                  <Field label="From" htmlFor="ledger-from" className="w-full sm:w-40">
                    <TextInput
                      id="ledger-from"
                      type="date"
                      value={fromDay}
                      max={toDay || undefined}
                      onChange={(e) => {
                        setFromDay(e.target.value);
                        setPage(1);
                      }}
                    />
                  </Field>
                  <Field label="To" htmlFor="ledger-to" className="w-full sm:w-40">
                    <TextInput
                      id="ledger-to"
                      type="date"
                      value={toDay}
                      min={fromDay || undefined}
                      onChange={(e) => {
                        setToDay(e.target.value);
                        setPage(1);
                      }}
                    />
                  </Field>
                  <Button onClick={handleExport} disabled={exporting || rangeInvalid}>
                    {exporting ? "Exporting…" : "Export CSV"}
                  </Button>
                </div>
                {rangeInvalid ? (
                  <p role="alert" className="mt-2 text-xs text-[var(--av2-error-text)]">
                    The start date needs to be on or before the end date.
                  </p>
                ) : null}
              </div>

              {pagination?.total === 0 ? (
                hasFilters ? (
                  <EmptyState
                    title="No movements match these filters"
                    description="Try another type or date range, or clear the search."
                  />
                ) : (
                  <EmptyState title="No token movements yet." />
                )
              ) : (
                <div className={loading ? "mt-4 opacity-60" : "mt-4"} aria-busy={loading}>
                  <Table label="Token ledger">
                    <thead>
                      <tr>
                        <Th>Date</Th>
                        <Th className="max-2xl:hidden">Type</Th>
                        <Th>Amount</Th>
                        <Th className="max-md:hidden">Reason</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((entry) => (
                        <Tr
                          key={entry.id}
                          selected={entry.id === selected?.id}
                          onSelect={() => {
                            setSelectedId(entry.id);
                            setPanelClosed(false);
                            reveal();
                          }}
                          label={`${formatLedgerReason(entry.reason)}, ${formatSignedTokens(entry.direction, entry.amount)}`}
                        >
                          <Td className="2xl:whitespace-nowrap">
                            {formatDateTime(entry.createdAt)}
                          </Td>
                          {/* Below 2xl the sign carries the direction; the panel shows the badge. */}
                          <Td className="max-2xl:hidden">
                            <DirectionBadge direction={entry.direction} />
                          </Td>
                          <Td className="font-semibold tabular-nums 2xl:whitespace-nowrap">
                            {formatSignedTokens(entry.direction, entry.amount)}
                          </Td>
                          <Td className="max-md:hidden">{formatLedgerReason(entry.reason)}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                  {pagination ? (
                    <ListFooter
                      from={firstRow}
                      to={firstRow + rows.length - 1}
                      total={pagination.total}
                      page={pagination.page}
                      pageCount={pagination.pageCount}
                      onPage={setPage}
                    />
                  ) : null}
                </div>
              )}
            </Card>
          </SplitView>
        )}
      </div>
    </>
  );
}

function LedgerDetail({ entry, onClose }: { entry: LedgerEntry; onClose: () => void }) {
  return (
    <DetailPanel title={formatLedgerReason(entry.reason)} onClose={onClose}>
      <PanelSection>
        <div className="flex flex-wrap items-center gap-3">
          <DirectionBadge direction={entry.direction} />
          <span className="text-xl leading-7 font-semibold break-words tabular-nums">
            {formatSignedTokens(entry.direction, entry.amount)}
          </span>
        </div>
      </PanelSection>
      <PanelSection>
        <KeyValueList
          rows={[
            { label: "Date", value: formatDateTime(entry.createdAt) },
            { label: "Balance before", value: <RecordedBalance value={entry.balanceBefore} /> },
            { label: "Balance after", value: <RecordedBalance value={entry.balanceAfter} /> },
            { label: "Request", value: entry.ticketCode || DASH },
            { label: "Notes", value: entry.notes || DASH },
          ]}
        />
      </PanelSection>
    </DetailPanel>
  );
}
