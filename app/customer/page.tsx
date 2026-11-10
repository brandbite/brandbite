// -----------------------------------------------------------------------------
// @file: app/customer/page.tsx
// @purpose: Customer overview: tokens, requests that need attention, upcoming work,
//           company and plan. Everything shown comes from the customer's own data.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  IconAlertCircle,
  IconArrowUpRight,
  IconClock,
  IconCoins,
  IconDocument,
  IconTicket,
  IconUsers,
} from "@/components/admin/v2/icons";
import {
  Badge,
  ButtonLink,
  Callout,
  Card,
  CardTitle,
  DASH,
  EmptyState,
  fmt,
  IconTile,
  KpiCard,
  PageHeader,
  plural,
  Skeleton,
  StatusDot,
  Table,
  Td,
  Th,
  TextLink,
  TICKET_STATUS,
  type Tone,
} from "@/components/admin/v2/ui";
import { IconCatalog, IconMoodboards } from "@/components/navigation/nav-icons";
import { isDueDateOverdue } from "@/lib/board";
import {
  canCreateTickets,
  canEditTickets,
  canManagePlan,
  normalizeCompanyRole,
  type CompanyRole,
} from "@/lib/permissions/companyRoles";
import { buildTicketCode } from "@/lib/ticket-code";
import { useLiveRefresh } from "@/lib/hooks/use-live-refresh";
import { IntegrationsPrompt } from "@/components/dashboard/integrations-prompt";

/** Matches the admin dashboard's definition of a low-balance company. */
const LOW_BALANCE_TOKENS = 5;
const UPCOMING_LIMIT = 5;

type TicketStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";

type CustomerSettingsResponse = {
  user: {
    id: string;
    email: string;
    name: string | null;
    companyRole: CompanyRole | null;
  };
  company: {
    id: string;
    name: string;
    slug: string;
    counts: { members: number; projects: number; tickets: number };
  };
  plan: {
    id: string;
    name: string;
    monthlyTokens: number;
    priceCents: number | null;
    isActive: boolean;
  } | null;
};

type CustomerTokensResponse = {
  company: { tokenBalance: number };
  stats: { totalCredits: number; totalDebits: number };
};

type CustomerBoardTicket = {
  id: string;
  title: string;
  status: TicketStatus;
  dueDate: string | null;
  companyTicketNumber: number | null;
  project: { id: string; name: string; code: string | null } | null;
};

type CustomerBoardResponse = {
  stats: { byStatus: Record<TicketStatus, number>; total: number };
  tickets: CustomerBoardTicket[];
};

type DashboardData = {
  settings: CustomerSettingsResponse;
  tokens: CustomerTokensResponse;
  board: CustomerBoardResponse;
};

type DashboardState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: DashboardData };

const STATUS_ORDER: TicketStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];

const STATUS_FILL: Record<TicketStatus, string> = {
  TODO: "var(--av2-fill-neutral)",
  IN_PROGRESS: "var(--av2-fill-lavender)",
  IN_REVIEW: "var(--av2-fill-orange)",
  DONE: "var(--av2-fill-green)",
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

function formatPrice(cents: number | null): string {
  if (cents == null) return DASH;
  const dollars = cents / 100;
  const amount = Number.isInteger(dollars)
    ? dollars.toLocaleString("en-US")
    : dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `$${amount}/mo`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function codeOf(ticket: CustomerBoardTicket): string {
  return buildTicketCode({
    projectCode: ticket.project?.code,
    companyTicketNumber: ticket.companyTicketNumber,
    ticketId: ticket.id,
  });
}

async function readJson<T>(url: string, label: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error || `${label} request failed with status ${res.status}`);
  return json as T;
}

function StatTile({ icon, value, label }: { icon: ReactNode; value: ReactNode; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <IconTile tone="neutral" size={44}>
        {icon}
      </IconTile>
      <div className="min-w-0">
        <p className="text-xl leading-7 font-bold tabular-nums">{value}</p>
        <p className="text-sm text-[var(--av2-text-2)]">{label}</p>
      </div>
    </div>
  );
}

export default function CustomerOverviewPage() {
  const [state, setState] = useState<DashboardState>({ status: "loading" });

  const [liveTick, setLiveTick] = useState(0);
  const liveRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [settings, tokens, board] = await Promise.all([
          readJson<CustomerSettingsResponse>("/api/customer/settings", "Settings"),
          readJson<CustomerTokensResponse>("/api/customer/tokens", "Tokens"),
          readJson<CustomerBoardResponse>("/api/customer/board", "Board"),
        ]);
        if (!cancelled) setState({ status: "ready", data: { settings, tokens, board } });
      } catch (err) {
        if (liveRef.current) return; // background refresh: keep what's on screen
        console.error("[CustomerOverview] load error", err);
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Failed to load your overview.",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [liveTick]);

  // Stay current without a reload: on return to the tab and every 30s while visible.
  useLiveRefresh(() => {
    liveRef.current = true;
    setLiveTick((t) => t + 1);
  });

  const data = state.status === "ready" ? state.data : null;
  const tickets = useMemo(() => data?.board.tickets ?? [], [data]);

  const upcoming = useMemo(
    () =>
      tickets
        .filter((t) => t.dueDate != null && t.status !== "DONE")
        .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
        .slice(0, UPCOMING_LIMIT),
    [tickets],
  );
  const toReview = useMemo(() => tickets.filter((t) => t.status === "IN_REVIEW"), [tickets]);

  const company = data?.settings.company ?? null;
  const plan = data?.settings.plan ?? null;
  const companyRole = normalizeCompanyRole(data?.settings.user.companyRole ?? null);
  const roleLabel = prettyCompanyRole(companyRole);
  const stats = data?.board.stats ?? null;
  const total = stats?.total ?? 0;
  const done = stats?.byStatus.DONE ?? 0;
  const open = total - done;
  const completion = total > 0 ? Math.round((done / total) * 100) : 0;
  const balance = data?.tokens.company.tokenBalance ?? null;

  return (
    <>
      <PageHeader
        title="Overview"
        description="Your creative workspace at a glance."
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
        actions={
          canCreateTickets(companyRole) ? (
            <ButtonLink href="/customer/tickets/new" variant="primary">
              + New request
            </ButtonLink>
          ) : null
        }
      />

      {state.status === "error" ? (
        <Callout tone="error" title="We couldn't load your overview">
          {state.message}
        </Callout>
      ) : state.status === "loading" ? (
        <div aria-busy="true" aria-label="Loading your overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
          </div>
          <Skeleton className="h-32" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <KpiCard
              icon={<IconCoins />}
              tone="green"
              label="Token balance"
              value={
                <>
                  {fmt(balance)}{" "}
                  <span className="text-xl font-semibold">
                    {plural(balance ?? 0, "token", "tokens")}
                  </span>
                </>
              }
              action={
                <TextLink href="/customer/tokens" arrow={false}>
                  View ledger
                </TextLink>
              }
              hint={
                balance != null && balance < LOW_BALANCE_TOKENS ? (
                  <Badge tone="amber" icon={<IconAlertCircle width={14} height={14} />}>
                    Low balance
                  </Badge>
                ) : undefined
              }
            />
            <KpiCard
              icon={<IconTicket />}
              tone="lavender"
              label="Open requests"
              value={
                <>
                  {fmt(open)}{" "}
                  <span className="text-xl font-medium text-[var(--av2-text-2)]">
                    of {fmt(total)} total
                  </span>
                </>
              }
              action={
                <TextLink href="/customer/board" arrow={false}>
                  Open board
                </TextLink>
              }
            />
            <KpiCard
              icon={<IconClock />}
              tone="green"
              label="Completed"
              value={
                <>
                  {fmt(done)}{" "}
                  <span className="text-xl font-medium text-[var(--av2-text-2)]">
                    of {fmt(total)} total
                  </span>
                </>
              }
              hint={
                total > 0 ? (
                  <>
                    <span className="text-sm text-[var(--av2-text)]">{completion}% completion</span>
                    <span
                      role="progressbar"
                      aria-label="Completion rate"
                      aria-valuenow={completion}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="mt-2 block h-2 w-full overflow-hidden rounded-full bg-[var(--av2-track)]"
                    >
                      <span
                        className="block h-full rounded-full bg-[var(--av2-fill-green)]"
                        style={{ width: `${completion}%` }}
                      />
                    </span>
                  </>
                ) : undefined
              }
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <Card className="flex items-center">
              <div className="flex w-full flex-wrap items-center gap-x-8 gap-y-4">
                <div className="flex min-w-[220px] flex-1 items-center gap-4">
                  <IconTile tone="peach">
                    <IconDocument />
                  </IconTile>
                  <div className="min-w-0">
                    <h2 className="text-xl leading-7 font-semibold">Token activity</h2>
                    <p className="text-sm text-[var(--av2-text-2)]">All-time totals</p>
                  </div>
                </div>
                <dl className="flex flex-wrap gap-x-8 gap-y-3">
                  <div className="min-w-0 border-l border-[var(--av2-border)] pl-6">
                    <dt className="text-sm text-[var(--av2-text-2)]">Credits</dt>
                    <dd className="text-xl leading-7 font-bold tabular-nums">
                      {fmt(data?.tokens.stats.totalCredits)}
                    </dd>
                  </div>
                  <div className="min-w-0 border-l border-[var(--av2-border)] pl-6">
                    <dt className="text-sm text-[var(--av2-text-2)]">Debits</dt>
                    <dd className="text-xl leading-7 font-bold tabular-nums">
                      {fmt(data?.tokens.stats.totalDebits)}
                    </dd>
                  </div>
                </dl>
              </div>
            </Card>

            <Card>
              <h2 className="text-xl leading-7 font-semibold">Workflow</h2>
              {total > 0 ? (
                <div
                  aria-hidden
                  className="mt-3 flex h-3 w-full gap-0.5 overflow-hidden rounded-full"
                >
                  {STATUS_ORDER.map((status) =>
                    (stats?.byStatus[status] ?? 0) > 0 ? (
                      <span
                        key={status}
                        style={{
                          flexGrow: stats?.byStatus[status] ?? 0,
                          background: STATUS_FILL[status],
                        }}
                      />
                    ) : null,
                  )}
                </div>
              ) : null}
              <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {STATUS_ORDER.map((status) => (
                  <div key={status} className="min-w-0">
                    <dt>
                      <StatusDot
                        tone={TICKET_STATUS[status].tone}
                        label={TICKET_STATUS[status].label}
                      />
                    </dt>
                    <dd className="mt-1 text-xl leading-7 font-bold tabular-nums">
                      {fmt(stats?.byStatus[status] ?? 0)}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          </div>

          {toReview.length > 0 && canEditTickets(companyRole) ? (
            <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--av2-attention-border)] bg-gradient-to-r from-[var(--av2-attention-from)] to-[var(--av2-attention-to)] p-6">
              <IconTile tone="peach" round>
                <IconClock />
              </IconTile>
              <div className="min-w-[240px] flex-1">
                <h2 className="text-xl leading-7 font-semibold">
                  {toReview.length === 1
                    ? "Needs your review"
                    : `${toReview.length} requests need your review`}
                </h2>
                <p className="mt-0.5 text-base">
                  <span className="text-[var(--av2-text-2)]">{codeOf(toReview[0])}</span>{" "}
                  {toReview[0].title}
                </p>
              </div>
              <ButtonLink href={`/customer/tickets/${toReview[0].id}`} variant="primary">
                Review request
                <IconArrowUpRight />
              </ButtonLink>
            </section>
          ) : null}

          <IntegrationsPrompt />

          <Card padding="none">
            <div className="px-6 pt-6 pb-4">
              <CardTitle>Upcoming requests</CardTitle>
            </div>
            {upcoming.length === 0 ? (
              <EmptyState
                title="No upcoming due dates"
                description="Open requests with a due date will appear here."
              />
            ) : (
              <Table label="Upcoming requests">
                <thead>
                  <tr>
                    <Th className="max-sm:hidden">ID</Th>
                    <Th>Request</Th>
                    <Th>Status</Th>
                    <Th>Due date</Th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((ticket) => {
                    const status = TICKET_STATUS[ticket.status];
                    const overdue = isDueDateOverdue(ticket.dueDate);
                    return (
                      <tr
                        key={ticket.id}
                        className="border-b border-[var(--av2-border)] last:border-b-0"
                      >
                        <Td className="whitespace-nowrap text-[var(--av2-text-2)] max-sm:hidden">
                          {codeOf(ticket)}
                        </Td>
                        <Td>
                          <Link
                            href={`/customer/tickets/${ticket.id}`}
                            className="font-medium hover:underline"
                          >
                            {ticket.title}
                          </Link>
                        </Td>
                        <Td>
                          <Badge tone={status.tone as Tone} dot>
                            {status.label}
                          </Badge>
                        </Td>
                        <Td className="whitespace-nowrap">
                          <span
                            className={overdue ? "font-medium text-[var(--av2-error-text)]" : ""}
                          >
                            {formatDate(ticket.dueDate!)}
                            {overdue ? " · Overdue" : ""}
                          </span>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardTitle description={company?.name}>Company</CardTitle>
              {company ? (
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <StatTile
                    icon={<IconUsers />}
                    value={fmt(company.counts.members)}
                    label={plural(company.counts.members, "member", "members")}
                  />
                  <StatTile
                    icon={<IconMoodboards width={20} height={20} />}
                    value={fmt(company.counts.projects)}
                    label={plural(company.counts.projects, "project", "projects")}
                  />
                  <StatTile
                    icon={<IconTicket />}
                    value={fmt(company.counts.tickets)}
                    label={plural(company.counts.tickets, "request", "requests")}
                  />
                </div>
              ) : null}
            </Card>

            <Card>
              <CardTitle
                description={plan?.name}
                action={
                  canManagePlan(companyRole) ? (
                    <TextLink href="/customer/settings" arrow={false}>
                      Manage plan
                    </TextLink>
                  ) : undefined
                }
              >
                Plan
              </CardTitle>
              {plan ? (
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <StatTile
                    icon={<IconCoins />}
                    value={fmt(plan.monthlyTokens)}
                    label="monthly tokens"
                  />
                  <StatTile
                    icon={<IconCatalog width={20} height={20} />}
                    value={formatPrice(plan.priceCents)}
                    label="price"
                  />
                </div>
              ) : (
                <p className="mt-3 text-sm text-[var(--av2-text-2)]">
                  No plan is assigned yet. Please contact support.
                </p>
              )}
              {!canManagePlan(companyRole) ? (
                <p className="mt-4 text-sm text-[var(--av2-text-2)]">
                  Only the owner or billing manager can change billing details.
                </p>
              ) : null}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
