// -----------------------------------------------------------------------------
// @file: app/admin/completed-jobs/page.tsx
// @purpose: Admin view for recently completed (DONE) tickets and whether each
//           one has a matching creative payout ledger entry. List on the left,
//           detail panel of the selected job on the right (design language v1).
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-11-01
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  ButtonLink,
  Callout,
  Card,
  DASH,
  DetailPanel,
  EmptyState,
  FilterBar,
  IconTile,
  KeyValueList,
  KpiCard,
  PageHeader,
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
import { IconAlertCircle, IconCoins, IconDocument, IconTicket } from "@/components/admin/v2/icons";

type CompletedJob = {
  ticketId: string;
  code: string;
  title: string;
  companyName: string | null;
  projectName: string | null;
  creativeName: string | null;
  creativeEmail: string | null;
  completedAt: string;
  jobTypeName: string | null;
  creativePayoutTokens: number | null;
  hasPayoutEntry: boolean;
  payoutLedgerCreatedAt: string | null;
};

type CompletedJobsResponse = {
  jobs: CompletedJob[];
};

type LedgerFilter = "ALL" | "FOUND" | "NOT_FOUND";

const formatDateTime = (iso: string | null): string => {
  if (!iso) return DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return DASH;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

const formatDate = (iso: string | null): string => {
  if (!iso) return DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return DASH;
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
};

const formatTime = (iso: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString(undefined, { timeStyle: "short" });
};

const tokens = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? `${fmt(n)} ${plural(n, "token", "tokens")}` : DASH;

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

function IconCheckCircle() {
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
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  );
}

function LedgerBadge({ found }: { found: boolean }) {
  return found ? (
    <Badge tone="green" dot>
      Entry found
    </Badge>
  ) : (
    <Badge tone="amber" dot>
      No entry found
    </Badge>
  );
}

export default function AdminCompletedJobsPage() {
  const [data, setData] = useState<CompletedJob[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<boolean>(false);

  const [search, setSearch] = useState<string>("");
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/completed-jobs", {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as
        | CompletedJobsResponse
        | { error?: string }
        | null;

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("You need to sign in as an admin.");
        }
        if (res.status === 403) {
          throw new Error(
            (json as any)?.error || "You do not have access to completed jobs in this workspace.",
          );
        }
        const msg = (json as any)?.error || `Request failed with status ${res.status}`;
        throw new Error(msg);
      }

      setData((json as CompletedJobsResponse).jobs ?? []);
      setLoaded(true);
    } catch (err: unknown) {
      console.error("[AdminCompletedJobs] load error", err);
      const message = err instanceof Error ? err.message : "Failed to load completed jobs.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const initial = async () => {
      if (cancelled) return;
      await load();
    };

    initial();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();

    return data.filter((job) => {
      if (ledgerFilter === "FOUND" && !job.hasPayoutEntry) return false;
      if (ledgerFilter === "NOT_FOUND" && job.hasPayoutEntry) return false;
      if (!q) return true;

      const haystack = [
        job.code,
        job.title,
        job.companyName ?? "",
        job.projectName ?? "",
        job.creativeName ?? "",
        job.creativeEmail ?? "",
        job.jobTypeName ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [data, search, ledgerFilter]);

  const stats = useMemo(() => {
    const total = data.length;
    const withPayout = data.filter((j) => j.hasPayoutEntry).length;
    const withoutPayout = total - withPayout;
    const priced = data.filter((j) => typeof j.creativePayoutTokens === "number");
    const totalTokens = priced.length
      ? priced.reduce((sum, j) => sum + (j.creativePayoutTokens ?? 0), 0)
      : null;

    return {
      total,
      withPayout,
      withoutPayout,
      totalTokens,
      unpriced: total - priced.length,
    };
  }, [data]);

  const filtersActive = ledgerFilter !== "ALL" || search.trim() !== "";
  const resetFilters = () => {
    setLedgerFilter("ALL");
    setSearch("");
  };

  const selected = data.find((j) => j.ticketId === selectedId) ?? null;
  const showStats = loaded;
  // Below 2xl the Company column folds into the Ticket cell. With the panel
  // open between xl and 2xl the table is narrower still, so Completed (also
  // shown in the panel) is dropped there.
  const hideWhenPanel = selected ? "xl:max-2xl:hidden" : "";

  // ---------------------------------------------------------------------------
  // Detail panel
  // ---------------------------------------------------------------------------

  const panel = selected ? (
    <DetailPanel
      title="Job details"
      onClose={() => setSelectedId(null)}
      closeLabel="Close job details"
    >
      <p className="text-2xl leading-8 font-bold break-words">{selected.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span className="text-sm text-[var(--av2-text-2)]">{selected.code}</span>
        <Badge tone="green" dot>
          Done
        </Badge>
      </div>

      <div className="mt-6">
        <PanelSection title="Job">
          <KeyValueList
            rows={[
              { label: "Company", value: selected.companyName ?? DASH },
              { label: "Project", value: selected.projectName ?? DASH },
              {
                label: "Creative",
                value: (
                  <>
                    <div>{selected.creativeName ?? DASH}</div>
                    {selected.creativeEmail && (
                      <div className="text-xs font-normal break-all text-[var(--av2-text-2)]">
                        {selected.creativeEmail}
                      </div>
                    )}
                  </>
                ),
              },
              { label: "Job type", value: selected.jobTypeName ?? DASH },
              {
                label: "Completed",
                value: <span className="tabular-nums">{formatDateTime(selected.completedAt)}</span>,
              },
              {
                label: "Payout tokens",
                value: (
                  <span className="tabular-nums">{tokens(selected.creativePayoutTokens)}</span>
                ),
              },
            ]}
          />
          <p className="mt-3 text-xs text-[var(--av2-text-2)]">
            Payout tokens come from the job type&apos;s current settings, not from the ledger entry.
          </p>
        </PanelSection>

        <PanelSection title="Payout ledger entry">
          {selected.hasPayoutEntry ? (
            <div className="flex items-start gap-3">
              <IconTile tone="green" size={40} round>
                <IconCheckCircle />
              </IconTile>
              <div className="min-w-0 text-sm">
                <p className="font-semibold">Ledger entry found</p>
                <p className="mt-0.5 text-[var(--av2-text-2)] tabular-nums">
                  Recorded {formatDateTime(selected.payoutLedgerCreatedAt)}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <IconTile tone="amber" size={40} round>
                <IconAlertCircle />
              </IconTile>
              <div className="min-w-0 text-sm">
                <p className="font-semibold">No ledger entry found</p>
                <p className="mt-0.5 text-[var(--av2-text-2)]">
                  No payout entry is linked to this ticket. Check the token ledger before
                  reconciling — this alone doesn&apos;t mean the creative wasn&apos;t paid.
                </p>
              </div>
            </div>
          )}
        </PanelSection>

        <PanelSection>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/admin/ledger" variant="primary" className="flex-1">
              View token ledger
            </ButtonLink>
            <ButtonLink href={`/admin/tickets/${selected.ticketId}`} className="flex-1">
              Open ticket
            </ButtonLink>
          </div>
        </PanelSection>
      </div>
    </DetailPanel>
  ) : null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <PageHeader
        title="Completed jobs"
        description="Review finished work and match it to creative payout ledger entries."
        actions={<ButtonLink href="/admin/board">Back to board</ButtonLink>}
      />

      {error && (
        <div className="mb-6">
          <Callout tone="error" title="Something went wrong">
            {error}
          </Callout>
        </div>
      )}

      <SplitView panel={panel}>
        {/* Summary cards */}
        <div
          className={`mb-6 grid gap-4 sm:grid-cols-2 ${selected ? "2xl:grid-cols-4" : "xl:grid-cols-4"}`}
        >
          <KpiCard
            icon={<IconTicket />}
            tone="lavender"
            label="Completed jobs"
            value={showStats ? fmt(stats.total) : DASH}
            hint="Most recent 100 Done tickets"
          />
          <KpiCard
            icon={<IconDocument />}
            tone="green"
            label="Ledger entry found"
            value={showStats ? fmt(stats.withPayout) : DASH}
            hint="Payout entry linked to the ticket"
          />
          <KpiCard
            icon={<IconAlertCircle />}
            tone="amber"
            label="No entry found"
            value={showStats ? fmt(stats.withoutPayout) : DASH}
            hint="Check before reconciling"
          />
          <KpiCard
            icon={<IconCoins />}
            tone="peach"
            label="Payout tokens"
            value={showStats ? fmt(stats.totalTokens) : DASH}
            hint={
              showStats && stats.unpriced > 0
                ? `${fmt(stats.unpriced)} ${plural(stats.unpriced, "job", "jobs")} without a payout value`
                : "From job type settings"
            }
          />
        </div>

        {showStats && stats.withoutPayout > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--av2-attention-border)] bg-gradient-to-r from-[var(--av2-attention-from)] to-[var(--av2-attention-to)] px-6 py-4">
            <IconTile tone="amber" size={40} round>
              <IconAlertCircle />
            </IconTile>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold">
                {fmt(stats.withoutPayout)} completed{" "}
                {plural(stats.withoutPayout, "job has", "jobs have")} no matching ledger entry
              </p>
              <p className="mt-0.5 text-sm text-[var(--av2-text-2)]">
                Review {plural(stats.withoutPayout, "it", "them")} against the token ledger before
                reconciling.
              </p>
            </div>
            {ledgerFilter !== "NOT_FOUND" ? (
              <Button onClick={() => setLedgerFilter("NOT_FOUND")}>Show these only</Button>
            ) : (
              <Button variant="ghost" onClick={() => setLedgerFilter("ALL")}>
                Show all jobs
              </Button>
            )}
          </div>
        )}

        <Card padding="none">
          <div className="px-6 pt-5">
            <div className="mb-4 flex flex-wrap items-baseline gap-3">
              <h2 className="text-xl leading-7 font-semibold">Completed work</h2>
              {loaded && (
                <span className="text-sm text-[var(--av2-text-2)] tabular-nums">
                  {fmt(filteredJobs.length)} {plural(filteredJobs.length, "result", "results")}
                </span>
              )}
            </div>
            <FilterBar>
              <SearchInput
                className="min-w-[220px] flex-1"
                value={search}
                onChange={setSearch}
                placeholder="Search ticket, company or creative"
                label="Search by ticket code, title, company, project or creative"
              />
              <div className="w-full sm:w-52">
                <Select
                  aria-label="Filter by ledger match"
                  value={ledgerFilter}
                  onChange={(e) => setLedgerFilter(e.target.value as LedgerFilter)}
                >
                  <option value="ALL">All ledger statuses</option>
                  <option value="FOUND">Ledger entry found</option>
                  <option value="NOT_FOUND">No ledger entry found</option>
                </Select>
              </div>
            </FilterBar>
          </div>

          {loading && !loaded ? (
            <div className="space-y-3 border-t border-[var(--av2-border)] px-6 py-5" role="status">
              <span className="sr-only">Loading completed jobs…</span>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !loaded ? (
            <div className="border-t border-[var(--av2-border)]">
              <EmptyState
                title="Completed jobs couldn't be loaded"
                description="See the error above, then reload the page."
              />
            </div>
          ) : data.length === 0 ? (
            <div className="border-t border-[var(--av2-border)]">
              <EmptyState
                icon={<IconTicket width={28} height={28} />}
                title="No completed jobs yet"
                description="Tickets appear here once a customer marks them as Done."
              />
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="border-t border-[var(--av2-border)]">
              <EmptyState
                title="No completed jobs match these filters"
                description="Try a different search or ledger status."
                action={<Button onClick={resetFilters}>Clear filters</Button>}
              />
            </div>
          ) : (
            <Table label="Completed jobs">
              <thead>
                <tr>
                  <Th>Ticket</Th>
                  <Th className="max-2xl:hidden">Company</Th>
                  <Th>Creative</Th>
                  <Th className={hideWhenPanel}>Completed</Th>
                  <Th align="right">Payout</Th>
                  <Th>Ledger entry</Th>
                  <Th align="right">
                    <span className="sr-only">Open</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job) => (
                  <Tr
                    key={job.ticketId}
                    selected={job.ticketId === selectedId}
                    onSelect={() => setSelectedId(job.ticketId)}
                    label={`${job.code} ${job.title}, ${
                      job.hasPayoutEntry ? "ledger entry found" : "no ledger entry found"
                    }`}
                  >
                    <Td>
                      <div className="font-semibold whitespace-nowrap">{job.code}</div>
                      <div className="line-clamp-2 max-w-[16rem] min-w-[8rem] text-xs text-[var(--av2-text-2)]">
                        {job.title}
                      </div>
                      <div className="mt-1 text-xs font-medium 2xl:hidden">
                        {[job.companyName, job.projectName].filter(Boolean).join(" · ") || DASH}
                      </div>
                    </Td>
                    <Td className="max-2xl:hidden">
                      <div className="min-w-[7rem] font-medium">{job.companyName ?? DASH}</div>
                      <div className="text-xs text-[var(--av2-text-2)]">
                        {job.projectName ?? DASH}
                      </div>
                    </Td>
                    <Td>
                      <div className="min-w-[7rem] font-medium">{job.creativeName ?? DASH}</div>
                      {job.jobTypeName && (
                        <div className="line-clamp-2 min-w-[7rem] text-xs text-[var(--av2-text-2)]">
                          {job.jobTypeName}
                        </div>
                      )}
                    </Td>
                    <Td className={`whitespace-nowrap tabular-nums ${hideWhenPanel}`}>
                      <div>{formatDate(job.completedAt)}</div>
                      {formatTime(job.completedAt) && (
                        <div className="text-xs text-[var(--av2-text-2)]">
                          {formatTime(job.completedAt)}
                        </div>
                      )}
                    </Td>
                    <Td align="right" className="whitespace-nowrap">
                      <span className="font-semibold">{tokens(job.creativePayoutTokens)}</span>
                    </Td>
                    <Td>
                      <LedgerBadge found={job.hasPayoutEntry} />
                      {job.payoutLedgerCreatedAt && (
                        <div className="mt-1 text-xs whitespace-nowrap text-[var(--av2-text-2)] tabular-nums">
                          {formatDate(job.payoutLedgerCreatedAt)}
                        </div>
                      )}
                    </Td>
                    <Td align="right" className="text-[var(--av2-text-2)]">
                      <span className="inline-flex">
                        <IconChevronRight />
                      </span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}

          {loaded && data.length > 0 && (
            <TableFooter>
              <span className="tabular-nums">
                Showing {fmt(filteredJobs.length)} of {fmt(data.length)} completed{" "}
                {plural(data.length, "job", "jobs")}
              </span>
              {filtersActive && (
                <Button size="sm" variant="ghost" onClick={resetFilters}>
                  Clear filters
                </Button>
              )}
            </TableFooter>
          )}
        </Card>

        <div className="mt-6">
          <Callout tone="info" title="About ledger matching">
            This view looks for a creative payout entry (JOB_PAYMENT or DESIGNER_JOB_PAYOUT) linked
            to each ticket. A missing entry doesn&apos;t by itself prove the creative wasn&apos;t
            paid — check the token ledger and withdrawals before acting. Completed dates use the
            ticket&apos;s last update.
          </Callout>
        </div>

        {!selected && loaded && data.length > 0 && (
          <p className="mt-6 flex items-center gap-2 text-sm text-[var(--av2-text-2)]">
            <IconDocument width={18} height={18} className="shrink-0" />
            Select a job to review its completion and ledger details.
          </p>
        )}
      </SplitView>
    </>
  );
}
