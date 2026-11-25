// -----------------------------------------------------------------------------
// @file: app/creative/page.tsx
// @purpose: Creative Home: a greeting banner that follows the time of day,
//           shortcuts, the requests to act on next, progress to the next
//           payout tier, the latest withdrawal and recent work. The numbers
//           that used to live here are on Stats (/creative/stats).
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  IconArrowRight,
  IconCheck,
  IconCoins,
  IconLayers,
  IconTicket,
  IconWallet,
} from "@/components/admin/v2/icons";
import {
  ButtonLink,
  Callout,
  fmt,
  IconTile,
  plural,
  Skeleton,
  TextLink,
} from "@/components/admin/v2/ui";
import { PauseBanner } from "@/components/creative/pause-banner";
import {
  formatDate,
  formatTokens,
  WithdrawalBadge,
  type WithdrawalStatus,
} from "@/components/dashboard/money/money-ui";
import {
  ArrowLink,
  AttentionList,
  HeroStat,
  HomeHero,
  useHeroSlot,
  RecentCards,
  ShortcutCards,
  type AttentionItem,
  type RecentItem as RecentCard,
} from "@/components/home/home-ui";
import { IconColorStudio, IconMoodboards, IconPortfolio } from "@/components/navigation/nav-icons";
import { IconTools } from "@/components/tools/tool-icons";
import { HERO_GREETING } from "@/lib/home/hero";
import {
  creativeMoves,
  recentWork,
  REMINDER_LIMIT,
  type HomeMoodboard,
  type HomeStatus,
  type HomeTicket,
} from "@/lib/home/home";
import { useLiveRefresh } from "@/lib/hooks/use-live-refresh";
import { buildTicketCode } from "@/lib/ticket-code";
import { allToolsHref } from "@/lib/tools/registry";

type BalanceResponse = {
  user: { id: string; email: string; name: string | null };
  balance: number;
};

type TicketsResponse = {
  stats: { openTotal?: number; total: number; byStatus: Record<HomeStatus, number> };
  tickets: {
    id: string;
    title: string;
    status: HomeStatus;
    dueDate: string | null;
    companyTicketNumber: number | null;
    createdAt: string;
    updatedAt: string;
    project: { id: string; name: string; code: string | null } | null;
    latestRevisionHasFeedback?: boolean;
  }[];
};

type WithdrawalsResponse = {
  withdrawals: { id: string; amountTokens: number; status: WithdrawalStatus; createdAt: string }[];
};

type PayoutTierResponse = {
  currentPayoutPercent: number;
  currentTierName: string | null;
  tiers: {
    id: string;
    name: string;
    minCompletedTickets: number;
    payoutPercent: number;
    completedInWindow: number;
    qualified: boolean;
  }[];
};

type HomeData = {
  balance: BalanceResponse;
  tickets: TicketsResponse;
  withdrawals: WithdrawalsResponse;
  payoutTier: PayoutTierResponse | null;
  moodboards: HomeMoodboard[];
  /** null when the skills request failed: don't nag about setup on a guess. */
  skillCount: number | null;
};

type HomeState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: HomeData; now: Date };

async function readJson<T>(url: string, label: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error || `${label} request failed with status ${res.status}`);
  return json as T;
}

/** Extras the page must load without: a failure just leaves that part out. */
async function readOptional<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

const SHORTCUTS = [
  {
    href: "/creative/moodboards",
    title: "Moodboards",
    text: "Find your direction",
    icon: <IconMoodboards width={24} height={24} />,
    tone: "lavender" as const,
  },
  {
    href: "/colors",
    title: "Color Studio",
    text: "Build a palette",
    icon: <IconColorStudio width={24} height={24} />,
    tone: "green" as const,
  },
  {
    href: "/creative/portfolio",
    title: "Portfolio",
    text: "Your approved work",
    icon: <IconPortfolio width={24} height={24} />,
    tone: "peach" as const,
  },
  {
    href: allToolsHref("creative"),
    title: "All tools",
    text: "Explore your workspace",
    icon: <IconTools width={24} height={24} />,
    tone: "lavender" as const,
  },
];

const SETUP_LINK = "font-medium text-[var(--av2-link)] hover:underline";

function PayoutTierCard({ tier }: { tier: PayoutTierResponse }) {
  const next = tier.tiers.find((t) => !t.qualified) ?? null;
  const progress =
    next && next.minCompletedTickets > 0
      ? Math.min(Math.round((next.completedInWindow / next.minCompletedTickets) * 100), 100)
      : 100;
  const toGo = next ? Math.max(next.minCompletedTickets - next.completedInWindow, 0) : 0;

  return (
    <section className="rounded-2xl border border-[#e2dbf7] bg-[var(--av2-lavender-bg)] p-6 dark:border-[#352d57]">
      <h2 className="text-[22px] leading-7 font-semibold">
        {next ? "Your next payout tier" : "Top payout tier reached"}
      </h2>
      {next ? (
        <>
          <p className="mt-1 text-[15px] text-[var(--av2-text-2)]">
            {fmt(next.completedInWindow)} of {fmt(next.minCompletedTickets)} approved requests
          </p>
          <span
            role="progressbar"
            aria-label={`Progress to ${next.name}`}
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mt-3 block h-3 overflow-hidden rounded-full bg-[var(--av2-surface)]"
          >
            <span
              className="block h-full rounded-full bg-[#5b4fc4] dark:bg-[#8f80e8]"
              style={{ width: `${progress}%` }}
            />
          </span>
          <p className="mt-4 text-2xl leading-8 font-semibold text-[#4a3fa8] dark:text-[#b8adf7]">
            {fmt(toGo)} {plural(toGo, "approval", "approvals")} to go
          </p>
        </>
      ) : (
        <p className="mt-1 text-[15px] text-[var(--av2-text-2)]">
          You earn the highest rate on every approved request.
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-base font-medium tabular-nums">
          {next
            ? `${tier.currentPayoutPercent}% → ${next.payoutPercent}%`
            : `${tier.currentPayoutPercent}%`}
        </p>
        <TextLink href="/creative/settings?tab=payout" arrow={false}>
          <span className="inline-flex items-center gap-1.5 font-semibold">
            View tiers
            <IconArrowRight width={16} height={16} />
          </span>
        </TextLink>
      </div>
    </section>
  );
}

export default function CreativeHomePage() {
  const [state, setState] = useState<HomeState>({ status: "loading" });

  const [liveTick, setLiveTick] = useState(0);
  const liveRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [balance, tickets, withdrawals, payoutTier, skills, moodboards] = await Promise.all([
          readJson<BalanceResponse>("/api/creative/balance", "Balance"),
          readJson<TicketsResponse>("/api/creative/tickets", "Requests"),
          readJson<WithdrawalsResponse>("/api/creative/withdrawals", "Withdrawals"),
          readOptional<PayoutTierResponse>("/api/creative/payout-tier"),
          readOptional<{ selectedJobTypeIds?: string[] }>("/api/creative/skills"),
          readOptional<{ moodboards: { id: string; title: string; updatedAt: string }[] }>(
            "/api/moodboards",
          ),
        ]);
        if (cancelled) return;
        setState({
          status: "ready",
          // Read in the browser with the data: the server can't know the creative's time of day.
          now: new Date(),
          data: {
            balance,
            tickets,
            withdrawals,
            payoutTier,
            skillCount: skills ? (skills.selectedJobTypeIds?.length ?? 0) : null,
            moodboards: (moodboards?.moodboards ?? []).map((m) => ({
              id: m.id,
              title: m.title,
              updatedAt: m.updatedAt,
            })),
          },
        });
      } catch (err) {
        if (liveRef.current) return; // background refresh: keep what's on screen
        console.error("[CreativeHome] load error", err);
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Failed to load your home page.",
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
  const now = state.status === "ready" ? state.now : null;
  const stats = data?.tickets.stats ?? null;
  const active = stats ? (stats.openTotal ?? stats.total - (stats.byStatus.DONE ?? 0)) : 0;
  const payoutTier = data?.payoutTier ?? null;
  const latestWithdrawal = data?.withdrawals.withdrawals[0] ?? null;
  const firstName = data?.balance.user.name?.trim().split(/\s+/)[0] ?? null;

  const tickets = useMemo<HomeTicket[]>(
    () =>
      (data?.tickets.tickets ?? []).map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        dueDate: t.dueDate,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        revisionRequested: Boolean(t.latestRevisionHasFeedback),
        code: buildTicketCode({
          projectCode: t.project?.code,
          companyTicketNumber: t.companyTicketNumber,
          ticketId: t.id,
        }),
      })),
    [data],
  );

  const moves = useMemo(() => creativeMoves(tickets), [tickets]);
  const shownMoves: AttentionItem[] = moves.slice(0, REMINDER_LIMIT).map((move) => ({
    key: move.key,
    title: move.title,
    detail: move.detail,
    badge: move.badge,
    action: move.action,
    tone: move.kind === "revision" ? "peach" : "lavender",
    icon: <IconTicket />,
  }));
  const inProgress = moves.find((move) => move.kind === "revision" || move.kind === "inProgress");

  const recent = useMemo<RecentCard[]>(() => {
    if (!data || !now) return [];
    return recentWork({ role: "creative", tickets, moodboards: data.moodboards, now }).map(
      (item) => ({
        key: item.key,
        title: item.title,
        href: item.href,
        badge: item.badge,
        detail: item.detail,
        tone: item.kind === "moodboard" ? "lavender" : "peach",
        icon:
          item.kind === "moodboard" ? <IconMoodboards width={24} height={24} /> : <IconTicket />,
      }),
    );
  }, [data, now, tickets]);

  const slot = useHeroSlot();
  const greeting = slot ? HERO_GREETING[slot] : "Welcome";

  return (
    <>
      <PauseBanner />

      <HomeHero
        slot={slot}
        loading={state.status === "loading"}
        date={
          now
            ? now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
            : null
        }
        title={firstName ? `${greeting}, ${firstName}` : greeting}
        tagline="Your next creative chapter is waiting."
        stats={
          data ? (
            <>
              <HeroStat icon={<IconTicket />} tone="green" href="/creative/board">
                {fmt(active)} active {plural(active, "request", "requests")}
              </HeroStat>
              <HeroStat icon={<IconCoins />} tone="lavender" href="/creative/balance">
                {formatTokens(data.balance.balance)} balance
              </HeroStat>
              {payoutTier ? (
                <HeroStat icon={<IconLayers />} tone="green" href="/creative/stats">
                  {payoutTier.currentPayoutPercent}% payout rate
                </HeroStat>
              ) : null}
            </>
          ) : null
        }
        actions={
          data ? (
            <>
              <ButtonLink href="/creative/board" variant="primary">
                Open board
                <IconArrowRight />
              </ButtonLink>
              {inProgress ? (
                <ButtonLink href={inProgress.action.href}>Upload a delivery</ButtonLink>
              ) : null}
            </>
          ) : null
        }
      />

      {state.status === "error" ? (
        <Callout tone="error" title="We couldn't load your home page">
          {state.message}
        </Callout>
      ) : state.status === "loading" ? (
        <div aria-busy="true" aria-label="Loading your home page" className="space-y-6">
          <Skeleton className="h-20" />
          <Skeleton className="h-64" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <div className="space-y-6">
          {data?.skillCount === 0 ? (
            <section className="rounded-2xl border border-[var(--av2-attention-border)] bg-gradient-to-r from-[var(--av2-attention-from)] to-[var(--av2-attention-to)] p-6">
              <h2 className="text-xl leading-7 font-semibold">Welcome to brandbite!</h2>
              <p className="mt-1 text-base text-[var(--av2-text-2)]">
                Set up your profile to start receiving request assignments:
              </p>
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
                <li>
                  <Link href="/creative/settings" className={SETUP_LINK}>
                    Select your skills
                  </Link>{" "}
                  so we can match you with the right requests
                </li>
                <li>
                  Wait for request assignments to appear here and on your{" "}
                  <Link href="/creative/board" className={SETUP_LINK}>
                    board
                  </Link>
                </li>
                <li>
                  Complete requests, earn tokens, and{" "}
                  <Link href="/creative/withdrawals" className={SETUP_LINK}>
                    withdraw your earnings
                  </Link>
                </li>
              </ol>
            </section>
          ) : null}

          <ShortcutCards items={SHORTCUTS} />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,5fr)] [&>*:only-child]:lg:col-span-2">
            <AttentionList
              title="Your next moves"
              items={shownMoves}
              total={moves.length}
              empty={
                <div className="flex flex-col items-center px-4 pt-6 pb-2 text-center">
                  <IconTile tone="green" size={48} round>
                    <IconCheck />
                  </IconTile>
                  <p className="mt-3 text-base font-semibold">No open requests right now</p>
                  <p className="mt-1 max-w-sm text-sm text-[var(--av2-text-2)]">
                    New assignments, revisions and due dates show up here.
                  </p>
                </div>
              }
              footer={
                moves.length > shownMoves.length ? (
                  <p className="mt-3 text-sm text-[var(--av2-text-2)]">
                    And {moves.length - shownMoves.length} more.{" "}
                    <TextLink href="/creative/board" arrow={false}>
                      Open board
                    </TextLink>
                  </p>
                ) : null
              }
            />
            {(payoutTier && payoutTier.tiers.length > 0) || latestWithdrawal ? (
              <div className="min-w-0 space-y-4">
                {payoutTier && payoutTier.tiers.length > 0 ? (
                  <PayoutTierCard tier={payoutTier} />
                ) : null}
                {latestWithdrawal ? (
                  <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-5">
                    <IconTile tone="green" size={44} round>
                      <IconWallet />
                    </IconTile>
                    <div className="min-w-[140px] flex-1">
                      <h2 className="flex flex-wrap items-center gap-2 text-[17px] leading-6 font-semibold">
                        Latest withdrawal
                        <WithdrawalBadge status={latestWithdrawal.status} />
                      </h2>
                      <p className="mt-0.5 text-sm text-[var(--av2-text-2)]">
                        {formatTokens(latestWithdrawal.amountTokens)} ·{" "}
                        {formatDate(latestWithdrawal.createdAt)}
                      </p>
                    </div>
                    <ArrowLink href="/creative/withdrawals">View withdrawals</ArrowLink>
                  </section>
                ) : null}
              </div>
            ) : null}
          </div>

          {recent.length > 0 ? (
            <section aria-labelledby="home-recent">
              <h2 id="home-recent" className="mb-3 text-[22px] leading-7 font-semibold">
                Pick up where you left off
              </h2>
              <RecentCards items={recent} />
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
