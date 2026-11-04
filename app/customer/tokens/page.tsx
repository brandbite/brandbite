// -----------------------------------------------------------------------------
// @file: app/customer/tokens/page.tsx
// @purpose: Customer-facing token balance & ledger view (session-based)
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";

import { IconCoins, IconTicket } from "@/components/admin/v2/icons";
import {
  Callout,
  Card,
  CardTitle,
  DASH,
  DetailPanel,
  EmptyState,
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
  Th,
  Tr,
} from "@/components/admin/v2/ui";
import {
  DirectionBadge,
  formatDateTime,
  formatLedgerReason,
  formatSignedTokens,
  ListFooter,
  pageOf,
  RecordedBalance,
  TokenFigure,
  useRevealPanel,
  type LedgerDirection,
} from "@/components/dashboard/money/money-ui";
import { canManageBilling, type CompanyRole } from "@/lib/permissions/companyRoles";

const PAGE_SIZE = 6;

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
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelClosed, setPanelClosed] = useState(false);
  const { ref: panelRef, reveal } = useRevealPanel();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/customer/tokens", {
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

        // Fetch company role in the background; failures here should not
        // block the main tokens view.
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
  }, []);

  const company = data?.company;
  const ledger = useMemo(() => data?.ledger ?? [], [data]);
  const needle = query.trim().toLowerCase();

  const filteredLedger = useMemo(
    () =>
      ledger.filter((entry) => {
        if (directionFilter !== "ALL" && entry.direction !== directionFilter) {
          return false;
        }
        if (needle) {
          const haystack = [
            entry.reason ?? "",
            formatLedgerReason(entry.reason),
            entry.notes ?? "",
            entry.ticketCode ?? "",
          ]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(needle)) return false;
        }
        return true;
      }),
    [ledger, directionFilter, needle],
  );

  const paged = pageOf(filteredLedger, page, PAGE_SIZE);
  // Derived from the visible rows, so the panel and the highlighted row always agree.
  const selected = panelClosed
    ? null
    : (paged.rows.find((e) => e.id === selectedId) ?? paged.rows[0] ?? null);

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

        <div className="grid gap-6 xl:grid-cols-3">
          <KpiCard
            icon={<IconCoins />}
            tone="green"
            label="Current balance"
            value={loading ? DASH : <TokenFigure value={data?.company.tokenBalance} />}
            hint="Your company's current token balance."
          />
          <KpiCard
            icon={<IconTicket />}
            tone="lavender"
            label="Credits"
            value={loading ? DASH : <TokenFigure value={data?.stats.totalCredits} unit={false} />}
            hint="Plan renewals, top-ups and adjustments in the 50 most recent movements."
          />
          <KpiCard
            icon={<IconTicket />}
            tone="peach"
            label="Debits"
            value={loading ? DASH : <TokenFigure value={data?.stats.totalDebits} unit={false} />}
            hint="Ticket work and other debits in the 50 most recent movements."
          />
        </div>

        {error ? null : loading ? (
          <div aria-busy="true" aria-label="Loading token ledger">
            <Skeleton className="h-96" />
          </div>
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
                <div className="mt-4 flex flex-wrap items-center gap-3">
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
                </div>
              </div>

              {ledger.length === 0 ? (
                <EmptyState title="No token movements yet." />
              ) : paged.total === 0 ? (
                <EmptyState
                  title="No movements match these filters"
                  description="Try another type, or clear the search."
                />
              ) : (
                <div className="mt-4">
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
                      {paged.rows.map((entry) => (
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
                  <ListFooter
                    {...paged}
                    onPage={setPage}
                    note="From the 50 most recent movements."
                  />
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
            { label: "Ticket", value: entry.ticketCode || DASH },
            { label: "Notes", value: entry.notes || DASH },
          ]}
        />
      </PanelSection>
    </DetailPanel>
  );
}
