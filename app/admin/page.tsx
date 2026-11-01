// -----------------------------------------------------------------------------
// @file: app/admin/page.tsx
// @purpose: Admin analytics dashboard — platform-wide metrics, ticket workflow,
//           "needs attention" health signals, token economy and withdrawal
//           queue. First screen migrated to the admin design language v1
//           (Plus Jakarta Sans + `.bb-admin-v2` tokens, applied by app/admin/layout.tsx).
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-11-01
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { InlineAlert } from "@/components/ui/inline-alert";
import {
  Card,
  DASH,
  IconTile,
  KpiCard,
  TextLink as CardLink,
  fmt,
  plural,
} from "@/components/admin/v2/ui";
import {
  IconAlertCircle,
  IconArrowUpRight,
  IconBuilding,
  IconClock,
  IconCoins,
  IconDocument,
  IconTicket,
  IconUsers,
  IconWallet,
} from "@/components/admin/v2/icons";

type TicketStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type AdminDashboardResponse = {
  platform: {
    totalCompanies: number;
    activeCompanies: number;
    totalCreatives: number;
    totalTickets: number;
    ticketsByStatus: Record<TicketStatus, number>;
    ticketsByPriority: Record<TicketPriority, number>;
    ticketsCreatedLast30Days: number;
    ticketsCompletedLast30Days: number;
    avgRevisionCount: number;
  };
  tokens: {
    globalCredits: number;
    globalDebits: number;
    globalNet: number;
    totalCompanyBalances: number;
  };
  withdrawals: {
    pendingCount: number;
    pendingAmount: number;
    totalPaid: number;
  };
  health: {
    companiesLowBalance: number;
    overdueTickets: number;
    staleTickets: number;
  };
};

type DashboardState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: AdminDashboardResponse };

// Status → fill. Guide: Backlog neutral, In progress lavender, In review
// orange, Done green. Every swatch also carries a visible text label.
const STATUS_META: { key: TicketStatus; label: string; fill: string }[] = [
  { key: "TODO", label: "Backlog", fill: "var(--av2-fill-neutral)" },
  { key: "IN_PROGRESS", label: "In progress", fill: "var(--av2-fill-lavender)" },
  { key: "IN_REVIEW", label: "In review", fill: "var(--av2-fill-orange)" },
  { key: "DONE", label: "Done", fill: "var(--av2-fill-green)" },
];

const PRIORITY_META: { key: TicketPriority; label: string; fill: string }[] = [
  { key: "URGENT", label: "Urgent", fill: "var(--av2-fill-red)" },
  { key: "HIGH", label: "High", fill: "var(--av2-fill-amber)" },
  { key: "MEDIUM", label: "Medium", fill: "var(--av2-fill-lavender)" },
  { key: "LOW", label: "Low", fill: "var(--av2-fill-neutral)" },
];

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function AttentionItem({
  icon,
  iconClass,
  count,
  title,
  description,
  href,
  linkLabel,
}: {
  icon: ReactNode;
  iconClass: string;
  count: number | null;
  title: string;
  description: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="flex gap-4 xl:px-6 xl:first:pl-0 xl:last:pr-0">
      <span
        className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${iconClass}`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[32px] leading-10 font-bold tabular-nums">{fmt(count)}</p>
        <p className="text-base font-semibold">{title}</p>
        <p className="mt-0.5 text-sm text-[var(--av2-text-2)]">{description}</p>
        <div className="mt-3">
          <CardLink href={href}>{linkLabel}</CardLink>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminDashboardPage() {
  const [state, setState] = useState<DashboardState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setState({ status: "loading" });

      try {
        const res = await fetch("/api/admin/dashboard", { cache: "no-store" });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(
            (json as any)?.error ?? `Dashboard request failed with status ${res.status}`,
          );
        }

        if (cancelled) return;

        setState({ status: "ready", data: json as AdminDashboardResponse });
      } catch (err: any) {
        console.error("[AdminDashboard] load error", err);
        if (!cancelled) {
          setState({
            status: "error",
            message: err?.message ?? "Failed to load admin dashboard. Please try again.",
          });
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const isLoading = state.status === "loading";
  const data = state.status === "ready" ? state.data : null;

  const platform = data?.platform ?? null;
  const tokens = data?.tokens ?? null;
  const withdrawals = data?.withdrawals ?? null;
  const health = data?.health ?? null;

  const totalTickets = platform?.totalTickets ?? 0;
  const statusRows = STATUS_META.map((s) => ({
    ...s,
    count: platform ? (platform.ticketsByStatus[s.key] ?? 0) : null,
  }));
  const priorityRows = PRIORITY_META.map((p) => ({
    ...p,
    count: platform ? (platform.ticketsByPriority[p.key] ?? 0) : null,
  }));

  const attentionAreas = health
    ? [health.overdueTickets, health.staleTickets, health.companiesLowBalance].filter((n) => n > 0)
        .length
    : null;

  const pendingCount = withdrawals?.pendingCount ?? 0;
  const net = tokens?.globalNet ?? null;

  return (
    <div>
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-[32px] leading-10 font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-base text-[var(--av2-text-2)]">
          A clear view of your creative operations.
        </p>
      </header>

      {state.status === "error" && (
        <InlineAlert variant="error" title="Something went wrong" className="mb-6">
          {state.message}
        </InlineAlert>
      )}

      {state.status !== "error" && (
        <div className="space-y-6" aria-busy={isLoading}>
          {isLoading && (
            <p className="sr-only" role="status">
              Loading dashboard…
            </p>
          )}

          {/* Row 1 — headline KPIs */}
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={<IconBuilding />}
              tone="lavender"
              label="Companies"
              value={fmt(platform?.totalCompanies)}
              hint={`${fmt(platform?.activeCompanies)} active in the last 30 days`}
            />
            <KpiCard
              icon={<IconUsers />}
              tone="peach"
              label="Creatives"
              value={fmt(platform?.totalCreatives)}
              hint="Registered on the platform"
            />
            <KpiCard
              icon={<IconTicket />}
              tone="lavender"
              label="Tickets"
              value={fmt(platform?.totalTickets)}
              hint={`${fmt(platform?.ticketsCreatedLast30Days)} created · ${fmt(
                platform?.ticketsCompletedLast30Days,
              )} completed in the last 30 days`}
            />
            <KpiCard
              icon={<IconCoins />}
              tone="green"
              label="Token balance"
              value={fmt(tokens?.totalCompanyBalances)}
              hint="Across all companies"
              highlight
            />
          </div>

          {/* Row 2 — needs attention */}
          <section
            aria-labelledby="needs-attention-title"
            className="rounded-2xl border border-[var(--av2-attention-border)] bg-gradient-to-r from-[var(--av2-attention-from)] to-[var(--av2-attention-to)] p-6"
          >
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h2 id="needs-attention-title" className="text-xl leading-7 font-semibold">
                Needs attention
              </h2>
              <p className="text-sm text-[var(--av2-text-2)]">
                {attentionAreas === null
                  ? DASH
                  : attentionAreas === 0
                    ? "All clear — nothing to check right now"
                    : `${attentionAreas} ${plural(attentionAreas, "area", "areas")} to check`}
              </p>
            </div>
            <div className="mt-4 grid divide-y divide-[var(--av2-attention-border)] xl:grid-cols-3 xl:divide-x xl:divide-y-0 [&>*]:py-4 xl:[&>*]:py-2">
              <AttentionItem
                icon={<IconClock />}
                iconClass="bg-[#fde3e1] text-[var(--av2-error)] dark:bg-[#3a1715]"
                count={health?.overdueTickets ?? null}
                title="Overdue tickets"
                description="Past due and not completed"
                href="/admin/board"
                linkLabel="View tickets"
              />
              <AttentionItem
                icon={<IconAlertCircle />}
                iconClass="bg-[#feead3] text-[#b25e09] dark:bg-[#37250f] dark:text-[#f2a33a]"
                count={health?.staleTickets ?? null}
                title="Stale tickets"
                description="In progress, no update for over 7 days"
                href="/admin/board"
                linkLabel="Review tickets"
              />
              <AttentionItem
                icon={<IconWallet />}
                iconClass="bg-[var(--av2-selected)] text-[var(--av2-link)] dark:bg-[#3a2016]"
                count={health?.companiesLowBalance ?? null}
                title="Low-balance companies"
                description="Fewer than 5 tokens remaining"
                href="/admin/companies"
                linkLabel="View companies"
              />
            </div>
          </section>

          {/* Row 3 — ticket workflow + priority */}
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Card>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl leading-7 font-semibold">Ticket workflow</h2>
                  <p className="mt-0.5 text-sm text-[var(--av2-text-2)]">
                    {platform
                      ? `${fmt(totalTickets)} ${plural(totalTickets, "ticket", "tickets")} across all stages`
                      : DASH}
                  </p>
                </div>
                <CardLink href="/admin/board">Open board</CardLink>
              </div>

              <div
                role="img"
                aria-label={
                  platform
                    ? `Ticket workflow: ${statusRows.map((s) => `${s.label} ${s.count}`).join(", ")}`
                    : "Ticket workflow loading"
                }
                className="mt-6 flex h-7 w-full gap-[3px] overflow-hidden rounded-lg bg-[var(--av2-track)]"
              >
                {totalTickets > 0 &&
                  statusRows.map((s) =>
                    s.count ? (
                      <span
                        key={s.key}
                        className="h-full first:rounded-l-lg last:rounded-r-lg"
                        style={{ width: `${(s.count / totalTickets) * 100}%`, background: s.fill }}
                      />
                    ) : null,
                  )}
              </div>

              <dl className="mt-6 grid grid-cols-2 gap-y-4 sm:grid-cols-4 sm:divide-x sm:divide-[var(--av2-border)]">
                {statusRows.map((s) => (
                  <div key={s.key} className="sm:px-6 sm:first:pl-0">
                    <dt className="flex items-center gap-2 text-sm text-[var(--av2-text-2)]">
                      <span
                        aria-hidden
                        className="h-3 w-3 rounded-full"
                        style={{ background: s.fill }}
                      />
                      {s.label}
                    </dt>
                    <dd className="mt-1 pl-5 text-2xl leading-8 font-bold tabular-nums">
                      {fmt(s.count)}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>

            <Card>
              <h2 className="text-xl leading-7 font-semibold">Priority breakdown</h2>
              <ul className="mt-5 space-y-4">
                {priorityRows.map((p) => {
                  const pct = totalTickets > 0 && p.count ? (p.count / totalTickets) * 100 : 0;
                  return (
                    <li
                      key={p.key}
                      className="grid grid-cols-[88px_minmax(0,1fr)_32px] items-center gap-4"
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <span
                          aria-hidden
                          className="h-3 w-3 rounded-full"
                          style={{ background: p.fill }}
                        />
                        {p.label}
                      </span>
                      <span
                        aria-hidden
                        className="h-2.5 overflow-hidden rounded-full bg-[var(--av2-track)]"
                      >
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${pct}%`, background: p.fill }}
                        />
                      </span>
                      <span className="text-right text-sm font-semibold tabular-nums">
                        {fmt(p.count)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>

          {/* Row 4 — token economy + withdrawal queue */}
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Card>
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-xl leading-7 font-semibold">Token economy</h2>
                <CardLink href="/admin/token-analytics">View analytics</CardLink>
              </div>

              <dl className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-x-8 gap-y-4">
                {[
                  { label: "Total credits", value: fmt(tokens?.globalCredits), tone: "" },
                  { label: "Total debits", value: fmt(tokens?.globalDebits), tone: "" },
                  {
                    label: "Net token flow",
                    value: net === null ? DASH : `${net > 0 ? "+" : ""}${net.toLocaleString()}`,
                    tone:
                      net === null
                        ? ""
                        : net < 0
                          ? "text-[var(--av2-error)]"
                          : "text-[var(--bb-success-text)]",
                  },
                ].map((m) => (
                  <div key={m.label} className="min-w-0">
                    <dt className="text-sm text-[var(--av2-text-2)]">{m.label}</dt>
                    <dd
                      className={`mt-1 text-[32px] leading-10 font-bold tracking-tight whitespace-nowrap tabular-nums ${m.tone}`}
                    >
                      {m.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <dl className="mt-6 grid gap-4 border-t border-[var(--av2-border)] pt-5 sm:grid-cols-2 sm:gap-0 sm:divide-x sm:divide-[var(--av2-border)]">
                <div className="flex items-center gap-4 sm:pr-6">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--av2-bg)] text-[var(--av2-text-2)]">
                    <IconDocument />
                  </span>
                  <div>
                    <dt className="text-sm text-[var(--av2-text-2)]">Avg. revisions</dt>
                    <dd className="flex items-baseline gap-2">
                      <span className="text-2xl leading-8 font-bold tabular-nums">
                        {fmt(platform?.avgRevisionCount)}
                      </span>
                      <span className="text-sm text-[var(--av2-text-2)]">per completed ticket</span>
                    </dd>
                  </div>
                </div>
                <div className="flex items-center gap-4 sm:pl-6">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--av2-bg)] text-[var(--av2-text-2)]">
                    <IconCoins />
                  </span>
                  <div>
                    <dt className="text-sm text-[var(--av2-text-2)]">Total paid out</dt>
                    <dd className="flex items-baseline gap-2">
                      <span className="text-2xl leading-8 font-bold tabular-nums">
                        {fmt(withdrawals?.totalPaid)}
                      </span>
                      <span className="text-sm text-[var(--av2-text-2)]">tokens</span>
                    </dd>
                  </div>
                </div>
              </dl>
            </Card>

            <Card className="flex flex-col">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <IconTile tone="peach">
                    <IconWallet />
                  </IconTile>
                  <h2 className="text-xl leading-7 font-semibold">Withdrawal queue</h2>
                </div>
                {withdrawals && (
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${
                      pendingCount > 0
                        ? "bg-[var(--av2-selected)] text-[var(--av2-link)]"
                        : "bg-[var(--av2-success-bg)] text-[var(--bb-success-text)]"
                    }`}
                  >
                    {pendingCount > 0 ? `${pendingCount} pending` : "All clear"}
                  </span>
                )}
              </div>

              <div className="mt-6 flex flex-1 flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[32px] leading-10 font-bold tracking-tight tabular-nums">
                    {fmt(withdrawals?.pendingAmount)} <span className="text-2xl">tokens</span>
                  </p>
                  <p className="text-sm text-[var(--av2-text-2)]">
                    {withdrawals
                      ? `Awaiting payout · ${pendingCount} ${plural(pendingCount, "request", "requests")}`
                      : DASH}
                  </p>
                </div>
                <Link
                  href="/admin/withdrawals"
                  className={`inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:ring-offset-2 focus-visible:outline-none ${
                    pendingCount > 0
                      ? "bg-[var(--av2-accent-strong)] text-white hover:brightness-110"
                      : "border border-[var(--av2-border)] text-[var(--av2-text)] hover:bg-[var(--av2-bg)]"
                  }`}
                >
                  {pendingCount > 0
                    ? `Review ${plural(pendingCount, "withdrawal", "withdrawals")}`
                    : "Open withdrawals"}
                  <IconArrowUpRight />
                </Link>
              </div>

              <div className="mt-6 border-t border-[var(--av2-border)] pt-4">
                <CardLink href="/admin/companies">View all companies</CardLink>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
