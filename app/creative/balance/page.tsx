// -----------------------------------------------------------------------------
// @file: app/creative/balance/page.tsx
// @purpose: Creative-facing token balance & ledger view (session-based)
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";

import { IconCoins, IconWallet } from "@/components/admin/v2/icons";
import {
  Button,
  ButtonLink,
  Callout,
  Card,
  CardTitle,
  DASH,
  EmptyState,
  FilterChips,
  KpiCard,
  PageHeader,
  SearchInput,
  Skeleton,
  Table,
  Td,
  TextLink,
  Th,
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
  type LedgerDirection,
} from "@/components/dashboard/money/money-ui";

const PAGE_SIZE = 10;

type DirectionFilter = "ALL" | LedgerDirection;

type LedgerEntry = {
  id: string;
  createdAt: string;
  direction: LedgerDirection;
  amount: number;
  reason: string | null;
  notes: string | null;
  metadata: unknown;
  balanceBefore: number | null;
  balanceAfter: number | null;
  ticketId: string | null;
  companyId: string | null;
};

type CreativeBalanceResponse = {
  /** Lifetime sums over the whole ledger (not just the rows below). */
  totals?: { credits: number; debits: number };
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  };
  balance: number;
  ledger: LedgerEntry[];
};

function exportLedgerCsv(ledger: LedgerEntry[]) {
  const rows = [
    ["Date", "Direction", "Amount", "Reason", "Balance After"],
    ...ledger.map((e) => [
      new Date(e.createdAt).toISOString(),
      e.direction,
      String(e.amount),
      e.reason ?? "",
      e.balanceAfter != null ? String(e.balanceAfter) : "",
    ]),
  ];
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "token-ledger.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function CreativeBalancePage() {
  const [data, setData] = useState<CreativeBalanceResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("ALL");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/creative/balance");
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          const msg = json?.error || `Request failed with status ${res.status}`;
          throw new Error(msg);
        }

        if (!cancelled) {
          setData(json as CreativeBalanceResponse);
        }
      } catch (err: any) {
        console.error("Creative balance fetch error:", err);
        if (!cancelled) {
          setError(err?.message || "Failed to load creative balance.");
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

  const creative = data?.user;
  const ledger = useMemo(() => data?.ledger ?? [], [data]);

  // Lifetime totals come from the API (whole ledger); fall back to summing
  // the visible rows only if an older API response has no totals.
  const totalCredits = useMemo(
    () =>
      data?.totals?.credits ??
      ledger.filter((l) => l.direction === "CREDIT").reduce((sum, l) => sum + l.amount, 0),
    [data?.totals?.credits, ledger],
  );

  const totalDebits = useMemo(
    () =>
      data?.totals?.debits ??
      ledger.filter((l) => l.direction === "DEBIT").reduce((sum, l) => sum + l.amount, 0),
    [data?.totals?.debits, ledger],
  );

  // No response means the numbers are unknown, not zero.
  const netBalance = data ? (data.balance ?? totalCredits - totalDebits) : null;

  const needle = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      ledger.filter((entry) => {
        if (directionFilter !== "ALL" && entry.direction !== directionFilter) return false;
        if (!needle) return true;
        return [entry.reason ?? "", formatLedgerReason(entry.reason), entry.notes ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      }),
    [ledger, directionFilter, needle],
  );
  const paged = pageOf(filtered, page, PAGE_SIZE);

  return (
    <>
      <PageHeader
        title="My token balance"
        description="Tokens you have earned from completed jobs and other adjustments."
        meta={
          creative ? (
            <>
              Signed in as{" "}
              <span className="font-medium text-[var(--av2-text)]">
                {creative.name || creative.email}
              </span>
            </>
          ) : null
        }
        actions={
          <>
            <ButtonLink href="/creative/withdrawals" variant="primary">
              Request withdrawal
            </ButtonLink>
            {ledger.length > 0 ? (
              <Button onClick={() => exportLedgerCsv(ledger)}>Export CSV</Button>
            ) : null}
          </>
        }
      />

      <div className="space-y-6">
        {error ? (
          <Callout tone="error" title="We couldn't load your balance">
            {error}
          </Callout>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-3">
          <KpiCard
            icon={<IconCoins />}
            tone="green"
            label="Token balance"
            value={loading ? DASH : <TokenFigure value={netBalance} />}
            hint="Your net balance after all credits and debits."
          />
          <KpiCard
            icon={<IconCoins />}
            tone="lavender"
            label="Total credits"
            value={loading || !data ? DASH : <TokenFigure value={totalCredits} />}
            hint="Tokens you have earned from jobs and adjustments."
          />
          <KpiCard
            icon={<IconWallet />}
            tone="peach"
            label="Total debits"
            value={loading || !data ? DASH : <TokenFigure value={totalDebits} />}
            hint="Tokens paid out to you through withdrawals."
          />
        </div>

        {error ? null : (
          <Callout>
            Your balance is not the same as what you can withdraw. Tokens held by pending and
            approved requests stay in this balance until the withdrawal is paid.{" "}
            <TextLink href="/creative/withdrawals" arrow={false}>
              See what you can request
            </TextLink>
          </Callout>
        )}

        {error ? null : loading ? (
          <div aria-busy="true" aria-label="Loading token ledger">
            <Skeleton className="h-96" />
          </div>
        ) : (
          <Card padding="none">
            <div className="px-6 pt-6">
              <CardTitle description="Showing the 50 most recent movements.">
                Recent token activity
              </CardTitle>
              {ledger.length > 0 ? (
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
                    placeholder="Search activity"
                    label="Search activity"
                  />
                </div>
              ) : null}
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
                <Table label="Recent token activity">
                  <thead>
                    <tr>
                      <Th>When</Th>
                      <Th className="max-sm:hidden">Type</Th>
                      <Th>Amount</Th>
                      <Th className="max-md:hidden">Reason</Th>
                      <Th className="max-md:hidden">Notes</Th>
                      <Th className="max-md:hidden">Balance</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.rows.map((entry) => (
                      <tr
                        key={entry.id}
                        className="border-b border-[var(--av2-border)] last:border-b-0"
                      >
                        <Td>
                          <span className="md:whitespace-nowrap">
                            {formatDateTime(entry.createdAt)}
                          </span>
                          {/* The narrow layout folds the hidden columns in here. */}
                          <span className="mt-1 block text-xs text-[var(--av2-text-2)] md:hidden">
                            {formatLedgerReason(entry.reason)}
                            {entry.notes ? ` · ${entry.notes}` : ""}
                          </span>
                          <span className="mt-0.5 block text-xs text-[var(--av2-text-2)] md:hidden">
                            Balance: <RecordedBalance value={entry.balanceAfter} />
                          </span>
                        </Td>
                        <Td className="max-sm:hidden">
                          <DirectionBadge direction={entry.direction} />
                        </Td>
                        <Td className="font-semibold whitespace-nowrap tabular-nums">
                          {formatSignedTokens(entry.direction, entry.amount)}
                        </Td>
                        <Td className="whitespace-nowrap max-md:hidden">
                          {formatLedgerReason(entry.reason)}
                        </Td>
                        <Td className="min-w-[160px] max-md:hidden">{entry.notes ?? DASH}</Td>
                        <Td className="whitespace-nowrap max-md:hidden">
                          <RecordedBalance value={entry.balanceAfter} />
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <ListFooter {...paged} onPage={setPage} />
              </div>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
