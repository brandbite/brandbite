// -----------------------------------------------------------------------------
// @file: app/admin/token-analytics/page.tsx
// @purpose: Admin-facing token analytics (global + per company), admin design
//           language v1. Scope is company token movements only — creative
//           wallet rows live in the global ledger (/admin/ledger). KPI cards
//           + a per-company breakdown table; the old single-series bar chart
//           duplicated the table's net column and was removed.
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-11-01
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Button,
  ButtonLink,
  Callout,
  Card,
  CardTitle,
  DASH,
  EmptyState,
  FilterBar,
  IconTile,
  KpiCard,
  PageHeader,
  Pager,
  Select,
  Skeleton,
  Table,
  TableFooter,
  Td,
  TextLink,
  Th,
  Tr,
  fmt,
  plural,
} from "@/components/admin/v2/ui";
import { IconArrowUpRight, IconBuilding, IconCoins } from "@/components/admin/v2/icons";

type CompanyAnalytics = {
  companyId: string;
  company: {
    id: string;
    name: string;
    slug: string;
  } | null;
  totalCredits: number;
  totalDebits: number;
  netTokens: number;
  entriesCount: number;
};

type TokenAnalyticsResponse = {
  stats: {
    globalCredits: number;
    globalDebits: number;
    globalNet: number;
    companiesWithLedger: number;
    ledgerEntriesCount: number;
  };
  perCompany: CompanyAnalytics[];
};

const PAGE_SIZE = 15;

/** Signed token amount: "+12", "−235" (true minus sign), "0". */
function signed(n: number | null | undefined) {
  if (typeof n !== "number" || !Number.isFinite(n)) return DASH;
  if (n > 0) return `+${fmt(n)}`;
  if (n < 0) return `−${fmt(Math.abs(n))}`;
  return "0";
}

function Glyph({ children }: { children: ReactNode }) {
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
      {children}
    </svg>
  );
}

const IconFlow = () => (
  <Glyph>
    <path d="M4 8h14l-3-3M20 16H6l3 3" />
  </Glyph>
);
const IconUp = () => (
  <Glyph>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </Glyph>
);
const IconDown = () => (
  <Glyph>
    <path d="M12 5v14M19 12l-7 7-7-7" />
  </Glyph>
);
const IconBook = () => (
  <Glyph>
    <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z" />
    <path d="M5 17a3 3 0 0 1 3-3h11M9 8h6" />
  </Glyph>
);

export default function AdminTokenAnalyticsPage() {
  const [data, setData] = useState<TokenAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [companyFilter, setCompanyFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/admin/token-analytics", {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          if (res.status === 401) {
            throw new Error("You must be signed in as an admin to view this page.");
          }
          if (res.status === 403) {
            throw new Error("You do not have permission to view token analytics.");
          }
          const msg = json?.error || `Request failed with status ${res.status}`;
          throw new Error(msg);
        }

        if (!cancelled) {
          setData(json as TokenAnalyticsResponse);
        }
      } catch (err: any) {
        console.error("Admin token analytics fetch error:", err);
        if (!cancelled) {
          setError(err?.message || "Failed to load token analytics.");
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

  const stats = data?.stats;
  const companies = useMemo(() => data?.perCompany ?? [], [data]);

  const companyNames = useMemo(
    () =>
      Array.from(
        new Set(companies.map((c) => c.company?.name).filter((n): n is string => !!n)),
      ).sort((a, b) => a.localeCompare(b)),
    [companies],
  );

  const filteredCompanies = useMemo(
    () =>
      companies.filter((c) => {
        if (companyFilter === "ALL") return true;
        return c.company?.name === companyFilter;
      }),
    [companies, companyFilter],
  );

  const pageCount = Math.max(1, Math.ceil(filteredCompanies.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filteredCompanies.slice(pageStart, pageStart + PAGE_SIZE);

  const filtersActive = companyFilter !== "ALL";
  const resetFilters = () => {
    setCompanyFilter("ALL");
    setPage(1);
  };

  const pending = loading && !data;

  return (
    <>
      <PageHeader
        title="Token analytics"
        description="Company token movements only. Creative payouts and withdrawals are in the global ledger."
        actions={
          <ButtonLink href="/admin/ledger">
            Open global ledger
            <IconArrowUpRight />
          </ButtonLink>
        }
      />

      {error && (
        <div className="mb-6">
          <Callout tone="error" title="Something went wrong">
            {error}
          </Callout>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-baseline gap-x-2">
        <h2 className="text-lg font-semibold">Company ledger totals</h2>
        <span className="text-sm text-[var(--av2-text-2)]">· All time</span>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <KpiCard
          icon={<IconFlow />}
          tone="peach"
          label="Net token flow"
          value={pending ? DASH : signed(stats?.globalNet)}
          hint="Total credits minus debits across all companies"
        />
        <KpiCard
          icon={<IconUp />}
          tone="green"
          label="Total credits"
          value={pending ? DASH : fmt(stats?.globalCredits)}
          hint="Tokens added via plans, top-ups, bonuses, etc."
        />
        <KpiCard
          icon={<IconDown />}
          tone="red"
          label="Total debits"
          value={pending ? DASH : fmt(stats?.globalDebits)}
          hint="Tokens spent on requests and corrections"
        />
        <KpiCard
          icon={<IconBuilding />}
          tone="lavender"
          label="Companies with activity"
          value={pending ? DASH : fmt(stats?.companiesWithLedger)}
          hint={
            stats
              ? `${fmt(stats.ledgerEntriesCount)} company ${plural(
                  stats.ledgerEntriesCount,
                  "entry",
                  "entries",
                )} in total`
              : "Companies with at least one ledger entry"
          }
        />
      </div>

      <Card padding="none">
        <div className="px-6 pt-5">
          <div className="mb-4">
            <CardTitle
              description="Sorted by net token flow, highest first."
              action={
                data ? (
                  <span className="pt-1 text-sm whitespace-nowrap text-[var(--av2-text-2)] tabular-nums">
                    {fmt(companies.length)} {plural(companies.length, "company", "companies")} with
                    ledger activity
                  </span>
                ) : null
              }
            >
              Company breakdown
            </CardTitle>
          </div>
          <FilterBar>
            <div className="w-full sm:w-64">
              <Select
                aria-label="Filter by company"
                value={companyFilter}
                onChange={(e) => {
                  setCompanyFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">All companies</option>
                {companyNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
            </div>
          </FilterBar>
        </div>

        {pending ? (
          <div className="space-y-3 border-t border-[var(--av2-border)] px-6 py-5" role="status">
            <span className="sr-only">Loading companies…</span>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : companies.length === 0 ? (
          <div className="border-t border-[var(--av2-border)]">
            <EmptyState
              icon={<IconCoins width={28} height={28} />}
              title="No company token activity yet"
              description="Totals appear here once companies start buying and spending tokens."
            />
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="border-t border-[var(--av2-border)]">
            <EmptyState
              title="No companies match this filter"
              description="Choose a different company or show all companies."
              action={<Button onClick={resetFilters}>Show all companies</Button>}
            />
          </div>
        ) : (
          <Table label="Token totals by company">
            <thead>
              <tr>
                <Th>Company</Th>
                <Th align="right">Credits</Th>
                <Th align="right">Debits</Th>
                <Th align="right">Net flow</Th>
                <Th align="right">Entries</Th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((c) => (
                <Tr key={c.companyId}>
                  <Td>
                    {c.company ? (
                      <>
                        <div className="font-semibold">{c.company.name}</div>
                        <div className="text-xs text-[var(--av2-text-2)]">{c.company.slug}</div>
                      </>
                    ) : (
                      <span className="text-[var(--av2-text-2)]">Unknown company</span>
                    )}
                  </Td>
                  <Td align="right">{fmt(c.totalCredits)}</Td>
                  <Td align="right">{fmt(c.totalDebits)}</Td>
                  <Td
                    align="right"
                    className={`font-semibold ${
                      c.netTokens < 0 ? "text-[var(--av2-error-text)]" : ""
                    }`}
                  >
                    {signed(c.netTokens)}
                  </Td>
                  <Td align="right" className="text-[var(--av2-text-2)]">
                    {fmt(c.entriesCount)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}

        {data && filteredCompanies.length > 0 && (
          <TableFooter>
            <span className="tabular-nums">
              Showing {fmt(pageStart + 1)}–{fmt(pageStart + pageRows.length)} of{" "}
              {fmt(filteredCompanies.length)}{" "}
              {plural(filteredCompanies.length, "company", "companies")}
              {filtersActive && ` (filtered from ${fmt(companies.length)})`}
            </span>
            <div className="flex flex-wrap items-center gap-3">
              {filtersActive && (
                <Button size="sm" variant="ghost" onClick={resetFilters}>
                  Clear filter
                </Button>
              )}
              <Pager page={currentPage} pageCount={pageCount} onPage={setPage} />
            </div>
          </TableFooter>
        )}
      </Card>

      {/* Explainers: what "net flow" means + the scope of these numbers. */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex gap-4">
            <IconTile tone="lavender">
              <IconFlow />
            </IconTile>
            <div className="min-w-0">
              <h2 className="text-xl leading-7 font-semibold">About net flow</h2>
              <p className="mt-2 text-sm text-[var(--av2-text-2)]">
                Credits minus debits over the recorded history. It is not a live balance — use the
                company profile to check a company&apos;s current token balance.
              </p>
              <div className="mt-3">
                <TextLink href="/admin/companies">Open companies</TextLink>
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex gap-4">
            <IconTile tone="green">
              <IconBook />
            </IconTile>
            <div className="min-w-0">
              <h2 className="text-xl leading-7 font-semibold">Company ledger scope</h2>
              <p className="mt-2 text-sm text-[var(--av2-text-2)]">
                These totals cover company token movements only. Creative wallet movements (request
                payouts and withdrawals) are excluded here; the global ledger shows both.
              </p>
              <div className="mt-3">
                <TextLink href="/admin/ledger">View global ledger</TextLink>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
