// -----------------------------------------------------------------------------
// @file: app/creative/page.tsx
// @purpose: Creative-facing overview dashboard (tokens + jobs + withdrawals)
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  IconArrowUpRight,
  IconCoins,
  IconDocument,
  IconTicket,
  IconWallet,
} from "@/components/admin/v2/icons";
import {
  Badge,
  ButtonLink,
  Callout,
  Card,
  CardTitle,
  DASH,
  EmptyState,
  FilterChips,
  fmt,
  IconTile,
  PageHeader,
  plural,
  PRIORITY,
  Skeleton,
  StatusDot,
  Table,
  Td,
  TextLink,
  Th,
  TICKET_STATUS,
} from "@/components/admin/v2/ui";
import { PauseBanner } from "@/components/creative/pause-banner";
import {
  formatDate,
  formatTokens,
  MiniStat,
  MoneyStat,
  TokenFigure,
  WithdrawalBadge,
  type WithdrawalStatus,
} from "@/components/dashboard/money/money-ui";
import { formatDueDateCountdown, isDueDateOverdue, isDueDateSoon } from "@/lib/board";
import { buildTicketCode } from "@/lib/ticket-code";

const NEXT_JOBS_LIMIT = 5;

type TicketStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type LedgerDirection = "CREDIT" | "DEBIT";

type CreativeBalanceResponse = {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  };
  balance: number;
  ledger: {
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
  }[];
};

type CreativeTicket = {
  id: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  dueDate: string | null;
  companyTicketNumber: number | null;
  createdAt: string;
  updatedAt: string;
  company: {
    id: string;
    name: string;
    slug: string;
  } | null;
  project: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  jobType: {
    id: string;
    name: string;
    tokenCost: number;
    creativePayoutTokens: number;
  } | null;
};

type CreativeTicketsResponse = {
  stats: {
    byStatus: Record<TicketStatus, number>;
    total: number;
    openTotal: number;
    byPriority: Record<TicketPriority, number>;
    loadScore: number;
  };
  tickets: CreativeTicket[];
};

type CreativeWithdrawal = {
  id: string;
  amountTokens: number;
  status: WithdrawalStatus;
  createdAt: string;
  approvedAt: string | null;
};

type CreativeWithdrawalsResponse = {
  stats: {
    availableBalance: number;
    reservedTokens: number;
    spendableBalance: number;
    totalRequested: number;
    pendingCount: number;
    withdrawalsCount: number;
  };
  withdrawals: CreativeWithdrawal[];
};

type PayoutTierResponse = {
  currentPayoutPercent: number;
  currentTierName: string | null;
  basePayoutPercent: number;
  tiers: {
    id: string;
    name: string;
    description: string | null;
    minCompletedTickets: number;
    timeWindowDays: number;
    payoutPercent: number;
    completedInWindow: number;
    qualified: boolean;
  }[];
};

type CreativeDashboardData = {
  balance: CreativeBalanceResponse;
  tickets: CreativeTicketsResponse;
  withdrawals: CreativeWithdrawalsResponse;
  payoutTier: PayoutTierResponse | null;
  skillCount: number;
};

type DashboardState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: CreativeDashboardData };

type NextJobsFilter = "ALL" | Exclude<TicketStatus, "DONE">;

const STATUS_ORDER: TicketStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
const OPEN_STATUSES: Exclude<TicketStatus, "DONE">[] = ["TODO", "IN_PROGRESS", "IN_REVIEW"];
const PRIORITY_ORDER: TicketPriority[] = ["URGENT", "HIGH", "MEDIUM", "LOW"];

/** Bands from the existing load score copy: below 50, 50-80, above 80. */
function loadBand(score: number): { label: string; color: string } {
  if (score > 80) return { label: "Heavy", color: "var(--av2-fill-red)" };
  if (score >= 50) return { label: "Moderate", color: "var(--av2-fill-amber)" };
  return { label: "Light", color: "var(--av2-fill-green)" };
}

function CountTile({ label, value }: { label: React.ReactNode; value: number | null | undefined }) {
  return (
    <div className="min-w-0 rounded-xl border border-[var(--av2-border)] p-3">
      <dt>{label}</dt>
      <dd className="mt-1 text-xl leading-7 font-bold tabular-nums">{fmt(value)}</dd>
    </div>
  );
}

function SetupStep({
  step,
  active = false,
  children,
}: {
  step: number;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          active
            ? "bg-[var(--av2-accent-strong)] text-white"
            : "bg-[var(--av2-surface)] text-[var(--av2-text-2)] ring-1 ring-[var(--av2-border)]"
        }`}
      >
        {step}
      </span>
      <span>{children}</span>
    </li>
  );
}

const SETUP_LINK = "font-medium text-[var(--av2-link)] hover:underline";

export default function CreativeDashboardPage() {
  const [state, setState] = useState<DashboardState>({ status: "loading" });
  const [jobsFilter, setJobsFilter] = useState<NextJobsFilter>("ALL");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setState({ status: "loading" });

      try {
        const [balanceRes, ticketsRes, withdrawalsRes, payoutTierRes, skillsRes] =
          await Promise.all([
            fetch("/api/creative/balance"),
            fetch("/api/creative/tickets"),
            fetch("/api/creative/withdrawals"),
            fetch("/api/creative/payout-tier"),
            fetch("/api/creative/skills"),
          ]);

        const [balanceJson, ticketsJson, withdrawalsJson, payoutTierJson, skillsJson] =
          await Promise.all([
            balanceRes.json().catch(() => null),
            ticketsRes.json().catch(() => null),
            withdrawalsRes.json().catch(() => null),
            payoutTierRes.json().catch(() => null),
            skillsRes.json().catch(() => null),
          ]);

        if (!balanceRes.ok) {
          const message =
            (balanceJson as any)?.error ||
            `Balance request failed with status ${balanceRes.status}`;
          throw new Error(message);
        }

        if (!ticketsRes.ok) {
          const message =
            (ticketsJson as any)?.error ||
            `Tickets request failed with status ${ticketsRes.status}`;
          throw new Error(message);
        }

        if (!withdrawalsRes.ok) {
          const message =
            (withdrawalsJson as any)?.error ||
            `Withdrawals request failed with status ${withdrawalsRes.status}`;
          throw new Error(message);
        }

        if (cancelled) return;

        const selectedSkills = skillsRes.ok ? ((skillsJson as any)?.selectedJobTypeIds ?? []) : [];

        setState({
          status: "ready",
          data: {
            balance: balanceJson as CreativeBalanceResponse,
            tickets: ticketsJson as CreativeTicketsResponse,
            withdrawals: withdrawalsJson as CreativeWithdrawalsResponse,
            payoutTier: payoutTierRes.ok ? (payoutTierJson as PayoutTierResponse) : null,
            skillCount: selectedSkills.length,
          },
        });
      } catch (err: any) {
        console.error("[CreativeDashboard] load error", err);
        if (!cancelled) {
          setState({
            status: "error",
            message: err?.message || "Failed to load creative overview. Please try again.",
          });
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const data = state.status === "ready" ? state.data : null;

  const user = data?.balance.user ?? null;
  const tokenBalance = data?.balance.balance ?? null;
  const lastLedgerEntry = data?.balance.ledger[0] ?? null;

  const ticketStats = data?.tickets.stats ?? null;
  const totalTickets = ticketStats?.total ?? 0;
  const doneTickets = ticketStats?.byStatus.DONE ?? 0;
  const openTickets =
    ticketStats?.openTotal != null
      ? ticketStats.openTotal
      : totalTickets > 0
        ? totalTickets - doneTickets
        : 0;
  const loadScore = ticketStats?.loadScore ?? null;

  const creativeTickets = useMemo(() => data?.tickets.tickets ?? [], [data]);
  const dueJobs = useMemo(
    () =>
      creativeTickets
        .filter((t) => t.dueDate != null && t.status !== "DONE")
        .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()),
    [creativeTickets],
  );
  const nextJobs = dueJobs
    .filter((t) => jobsFilter === "ALL" || t.status === jobsFilter)
    .slice(0, NEXT_JOBS_LIMIT);

  const payoutTier = data?.payoutTier ?? null;
  const nextTier = payoutTier?.tiers.find((t) => !t.qualified) ?? null;
  const nextTierProgress =
    nextTier && nextTier.minCompletedTickets > 0
      ? Math.min(Math.round((nextTier.completedInWindow / nextTier.minCompletedTickets) * 100), 100)
      : 0;

  const withdrawalStats = data?.withdrawals.stats ?? null;
  const recentWithdrawals = data?.withdrawals.withdrawals.slice(0, 3) ?? [];

  const band = loadScore != null ? loadBand(loadScore) : null;
  const gaugeValue = Math.min(Math.max(loadScore ?? 0, 0), 100);

  return (
    <>
      <PageHeader
        title="Overview"
        meta={
          user ? (
            <>
              Signed in as{" "}
              <span className="font-medium text-[var(--av2-text)]">{user.name || user.email}</span>
            </>
          ) : null
        }
      />

      <PauseBanner />

      {state.status === "error" ? (
        <Callout tone="error" title="We couldn't load your overview">
          {state.message}
        </Callout>
      ) : state.status === "loading" ? (
        <div aria-busy="true" aria-label="Loading overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
          <Skeleton className="h-32" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Welcome / setup guide for new creatives */}
          {data?.skillCount === 0 ? (
            <section className="rounded-2xl border border-[var(--av2-attention-border)] bg-gradient-to-r from-[var(--av2-attention-from)] to-[var(--av2-attention-to)] p-6">
              <h2 className="text-xl leading-7 font-semibold">Welcome to brandbite!</h2>
              <p className="mt-1 text-base text-[var(--av2-text-2)]">
                Set up your profile to start receiving ticket assignments:
              </p>
              <ol className="mt-4 space-y-3 text-sm">
                <SetupStep step={1} active>
                  <Link href="/creative/settings" className={SETUP_LINK}>
                    Select your skills
                  </Link>{" "}
                  so we can match you with the right tickets
                </SetupStep>
                <SetupStep step={2}>
                  Wait for ticket assignments to appear on your{" "}
                  <Link href="/creative/board" className={SETUP_LINK}>
                    board
                  </Link>
                </SetupStep>
                <SetupStep step={3}>
                  Complete tickets, earn tokens, and request{" "}
                  <Link href="/creative/withdrawals" className={SETUP_LINK}>
                    withdrawals
                  </Link>
                </SetupStep>
              </ol>
            </section>
          ) : null}

          {/* Headline numbers */}
          <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-4">
            <MoneyStat
              icon={<IconCoins />}
              tone="green"
              label="Token balance"
              action={
                <TextLink href="/creative/balance" arrow={false}>
                  View balance
                </TextLink>
              }
              value={<TokenFigure value={tokenBalance} />}
            >
              {lastLedgerEntry ? (
                <div className="rounded-xl bg-[var(--av2-bg)] px-3 py-3 text-sm">
                  <p className="font-medium">Last activity</p>
                  <p className="mt-1 text-[var(--av2-text-2)]">
                    {lastLedgerEntry.direction === "CREDIT" ? "Credited" : "Debited"}{" "}
                    {formatTokens(lastLedgerEntry.amount)} on{" "}
                    {formatDate(lastLedgerEntry.createdAt)}.
                  </p>
                </div>
              ) : null}
            </MoneyStat>

            <MoneyStat
              icon={<IconTicket />}
              tone="lavender"
              label="Active jobs"
              action={
                <TextLink href="/creative/board" arrow={false}>
                  Open board
                </TextLink>
              }
              value={
                <>
                  {fmt(openTickets)}{" "}
                  <span className="text-xl font-medium text-[var(--av2-text-2)]">
                    of {fmt(totalTickets)}
                  </span>
                </>
              }
            >
              {ticketStats ? (
                <dl className="space-y-2 rounded-xl bg-[var(--av2-bg)] px-3 py-3">
                  {OPEN_STATUSES.map((s) => (
                    <div key={s} className="flex items-center justify-between gap-3">
                      <dt>
                        <StatusDot tone={TICKET_STATUS[s].tone} label={TICKET_STATUS[s].label} />
                      </dt>
                      <dd className="text-sm font-bold tabular-nums">
                        {fmt(ticketStats.byStatus[s] ?? 0)}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </MoneyStat>

            <MoneyStat
              icon={<IconWallet />}
              tone="peach"
              label="Available to request"
              action={
                <TextLink href="/creative/withdrawals" arrow={false}>
                  Request payout
                </TextLink>
              }
              value={<TokenFigure value={withdrawalStats?.spendableBalance} />}
            >
              <div className="grid grid-cols-2 gap-2">
                <MiniStat value={fmt(withdrawalStats?.reservedTokens)} label="Held for requests" />
                <MiniStat value={fmt(withdrawalStats?.pendingCount)} label="Pending" />
                <MiniStat value={fmt(withdrawalStats?.totalRequested)} label="Total requested" />
                <MiniStat
                  value={fmt(withdrawalStats?.withdrawalsCount)}
                  label="Requests all time"
                />
              </div>
            </MoneyStat>

            <MoneyStat
              icon={<IconDocument />}
              tone="green"
              label="Current payout rate"
              action={
                <TextLink href="/creative/settings?tab=payout" arrow={false}>
                  View tiers
                </TextLink>
              }
              value={payoutTier ? `${payoutTier.currentPayoutPercent}%` : DASH}
              hint={payoutTier ? (payoutTier.currentTierName ?? "Base rate") : undefined}
            >
              {payoutTier && payoutTier.tiers.length > 0 ? (
                <div className="rounded-xl bg-[var(--av2-bg)] px-3 py-3 text-sm">
                  {nextTier ? (
                    <>
                      <p className="font-medium">
                        Next: {nextTier.name} ({nextTier.payoutPercent}%)
                      </p>
                      <span
                        role="progressbar"
                        aria-label={`Progress to ${nextTier.name}`}
                        aria-valuenow={nextTierProgress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        className="mt-2 block h-2 w-full overflow-hidden rounded-full bg-[var(--av2-track)]"
                      >
                        <span
                          className="block h-full rounded-full bg-[var(--av2-fill-lavender)]"
                          style={{ width: `${nextTierProgress}%` }}
                        />
                      </span>
                      <p className="mt-2 text-xs text-[var(--av2-text-2)] tabular-nums">
                        {fmt(nextTier.completedInWindow)}/{fmt(nextTier.minCompletedTickets)}{" "}
                        tickets
                      </p>
                    </>
                  ) : (
                    <p className="font-medium">Max tier reached</p>
                  )}
                </div>
              ) : null}
            </MoneyStat>
          </div>

          {/* Workload breakdowns */}
          {ticketStats && totalTickets > 0 ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardTitle description="All your jobs by workflow stage.">Workflow</CardTitle>
                <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {STATUS_ORDER.map((s) => (
                    <CountTile
                      key={s}
                      label={
                        <StatusDot tone={TICKET_STATUS[s].tone} label={TICKET_STATUS[s].label} />
                      }
                      value={ticketStats.byStatus[s] ?? 0}
                    />
                  ))}
                </dl>
              </Card>
              <Card>
                <CardTitle description="All your jobs by priority, including done ones.">
                  Priority breakdown
                </CardTitle>
                <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {PRIORITY_ORDER.map((p) => (
                    <CountTile
                      key={p}
                      label={<StatusDot tone={PRIORITY[p].tone} label={PRIORITY[p].label} />}
                      value={ticketStats.byPriority[p] ?? 0}
                    />
                  ))}
                </dl>
              </Card>
            </div>
          ) : null}

          {/* Upcoming deadlines */}
          {creativeTickets.length > 0 ? (
            <Card padding="none">
              <div className="flex flex-wrap items-start justify-between gap-4 px-6 pt-6">
                <div className="flex min-w-[240px] flex-1 items-center gap-4">
                  <IconTile tone="peach" round>
                    <IconDocument />
                  </IconTile>
                  <div className="min-w-0">
                    <h2 className="text-xl leading-7 font-semibold">Your next jobs</h2>
                    <p className="text-sm text-[var(--av2-text-2)]">
                      Your assigned jobs with due dates, soonest first.
                    </p>
                  </div>
                </div>
                <ButtonLink href="/creative/board" variant="primary">
                  Open board
                  <IconArrowUpRight />
                </ButtonLink>
              </div>

              {dueJobs.length === 0 ? (
                <EmptyState title="No upcoming deadlines." />
              ) : (
                <>
                  <div className="px-6 pt-4 pb-4">
                    <FilterChips
                      label="Filter next jobs by status"
                      options={[
                        { value: "ALL" as NextJobsFilter, label: "All", count: dueJobs.length },
                        ...OPEN_STATUSES.map((s) => ({
                          value: s as NextJobsFilter,
                          label: TICKET_STATUS[s].label,
                          count: dueJobs.filter((t) => t.status === s).length,
                        })),
                      ]}
                      value={jobsFilter}
                      onChange={setJobsFilter}
                    />
                  </div>
                  {nextJobs.length === 0 ? (
                    <EmptyState title="No jobs with a due date in this status." />
                  ) : (
                    <Table label="Your next jobs">
                      <thead>
                        <tr>
                          <Th className="max-sm:hidden">ID</Th>
                          <Th>Job</Th>
                          <Th className="max-md:hidden">Status</Th>
                          <Th className="max-md:hidden">Priority</Th>
                          <Th>Due date</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {nextJobs.map((t) => {
                          const countdown = formatDueDateCountdown(t.dueDate);
                          const overdue = isDueDateOverdue(t.dueDate);
                          const soon = isDueDateSoon(t.dueDate);
                          const status = TICKET_STATUS[t.status];
                          const priority = PRIORITY[t.priority];
                          return (
                            <tr
                              key={t.id}
                              className="border-b border-[var(--av2-border)] last:border-b-0"
                            >
                              <Td className="whitespace-nowrap text-[var(--av2-text-2)] max-sm:hidden">
                                {buildTicketCode({
                                  projectCode: t.project?.code,
                                  companyTicketNumber: t.companyTicketNumber,
                                  ticketId: t.id,
                                })}
                              </Td>
                              <Td>
                                <Link
                                  href={`/creative/tickets/${t.id}`}
                                  className="font-medium hover:underline"
                                >
                                  {t.title}
                                </Link>
                                {t.company ? (
                                  <p className="mt-0.5 text-xs text-[var(--av2-text-2)]">
                                    {t.company.name}
                                  </p>
                                ) : null}
                                <div className="mt-1 flex flex-wrap gap-1 md:hidden">
                                  <Badge tone={status.tone} dot>
                                    {status.label}
                                  </Badge>
                                  <Badge tone={priority.tone}>{priority.label}</Badge>
                                </div>
                              </Td>
                              <Td className="max-md:hidden">
                                <Badge tone={status.tone} dot>
                                  {status.label}
                                </Badge>
                              </Td>
                              <Td className="max-md:hidden">
                                <Badge tone={priority.tone}>{priority.label}</Badge>
                              </Td>
                              <Td>
                                <p className="whitespace-nowrap">{formatDate(t.dueDate)}</p>
                                {countdown ? (
                                  overdue ? (
                                    <Badge tone="red" className="mt-1">
                                      {countdown.label}
                                    </Badge>
                                  ) : soon ? (
                                    <Badge tone="amber" className="mt-1">
                                      {countdown.label}
                                    </Badge>
                                  ) : (
                                    <p className="mt-0.5 text-xs text-[var(--av2-text-2)]">
                                      {countdown.label}
                                    </p>
                                  )
                                ) : null}
                              </Td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  )}
                </>
              )}
            </Card>
          ) : null}

          {/* Load score + recent withdrawals */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardTitle>Load score</CardTitle>
              <div className="mt-4 flex flex-wrap items-center gap-6">
                <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
                  <svg
                    role="img"
                    aria-label={`Load score ${fmt(loadScore)}${band ? `, ${band.label}` : ""}`}
                    className="h-full w-full -rotate-90"
                    viewBox="0 0 36 36"
                  >
                    <circle
                      cx="18"
                      cy="18"
                      r="15.9155"
                      fill="none"
                      stroke="var(--av2-track)"
                      strokeWidth="3"
                    />
                    {band ? (
                      <circle
                        cx="18"
                        cy="18"
                        r="15.9155"
                        fill="none"
                        stroke={band.color}
                        strokeWidth="3"
                        strokeDasharray={`${gaugeValue} ${100 - gaugeValue}`}
                        strokeLinecap="round"
                      />
                    ) : null}
                  </svg>
                  <span aria-hidden className="absolute text-2xl leading-8 font-bold tabular-nums">
                    {fmt(loadScore)}
                  </span>
                </div>
                <div className="min-w-[200px] flex-1">
                  {band ? <p className="text-xl leading-7 font-semibold">{band.label}</p> : null}
                  <p className="mt-1 text-sm text-[var(--av2-text-2)]">
                    Weighted from the priority and token cost of your open jobs. Below 50 is light,
                    50-80 is moderate, above 80 is heavy.
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <CardTitle
                description="Your latest payout requests."
                action={
                  <TextLink href="/creative/withdrawals" arrow={false}>
                    View all
                  </TextLink>
                }
              >
                Recent withdrawals
              </CardTitle>
              {recentWithdrawals.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {recentWithdrawals.map((w) => (
                    <li
                      key={w.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--av2-bg)] px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold tabular-nums">{formatTokens(w.amountTokens)}</p>
                        <p className="text-sm text-[var(--av2-text-2)]">
                          {formatDate(w.createdAt)}
                        </p>
                      </div>
                      <WithdrawalBadge status={w.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-[var(--av2-text-2)]">No withdrawal requests yet.</p>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
