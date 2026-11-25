// -----------------------------------------------------------------------------
// @file: app/customer/page.tsx
// @purpose: Customer Home: a greeting banner that follows the time of day,
//           shortcuts, what needs the customer's attention, the brand setup,
//           recent work, last month in short and one suggestion. Everything
//           shown comes from the customer's own data.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  IconArrowRight,
  IconCheck,
  IconCoins,
  IconDocument,
  IconPlus,
  IconTicket,
} from "@/components/admin/v2/icons";
import {
  ButtonLink,
  Callout,
  FilterChips,
  fmt,
  IconTile,
  plural,
  Skeleton,
  TextLink,
} from "@/components/admin/v2/ui";
import { MonthlyRecapCard } from "@/components/engagement/monthly-recap-card";
import { BrandReadyCard, RecapMiniCard } from "@/components/home/customer-cards";
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
import {
  IconAiTools,
  IconBrandGuide,
  IconColorStudio,
  IconConsultation,
  IconMoodboards,
} from "@/components/navigation/nav-icons";
import { HERO_GREETING } from "@/lib/home/hero";
import {
  customerReminders,
  customerSuggestion,
  LOW_BALANCE_TOKENS,
  recentWork,
  REMINDER_LIMIT,
  type HomeDraft,
  type HomeMoodboard,
  type HomeStatus,
  type HomeTicket,
} from "@/lib/home/home";
import { useLiveRefresh } from "@/lib/hooks/use-live-refresh";
import {
  canBookConsultation,
  canCreateTickets,
  canEditTickets,
  normalizeCompanyRole,
  type CompanyRole,
} from "@/lib/permissions/companyRoles";
import { buildTicketCode } from "@/lib/ticket-code";

type CustomerSettingsResponse = {
  user: { id: string; email: string; name: string | null; companyRole: CompanyRole | null };
};

type CustomerTokensResponse = { company: { tokenBalance: number } };

type CustomerBoardResponse = {
  stats: { byStatus: Record<HomeStatus, number>; total: number };
  tickets: {
    id: string;
    title: string;
    status: HomeStatus;
    dueDate: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    companyTicketNumber: number | null;
    project: { id: string; name: string; code: string | null } | null;
    jobType?: { id: string; name: string } | null;
  }[];
};

type DraftsResponse = {
  drafts: { id: string; title?: string; updatedAt: string; attachments?: unknown[] }[];
};
type MoodboardsResponse = { moodboards: { id: string; title: string; updatedAt: string }[] };
type TicketListResponse = { tickets?: { id: string; thumbnailUrl?: string | null }[] };

type HomeData = {
  settings: CustomerSettingsResponse;
  tokens: CustomerTokensResponse;
  board: CustomerBoardResponse;
  drafts: HomeDraft[];
  moodboards: HomeMoodboard[];
  /** Request id → picture, where the request has one. */
  thumbnails: Record<string, string>;
};

type HomeState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: HomeData; now: Date };

type RecentFilter = "all" | "requests";

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
    href: "/customer/brand",
    title: "Brand guide",
    text: "Your brand, in one place",
    icon: <IconBrandGuide width={24} height={24} />,
    tone: "green" as const,
  },
  {
    href: "/customer/moodboards",
    title: "Moodboards",
    text: "Collect your next direction",
    icon: <IconMoodboards width={24} height={24} />,
    tone: "lavender" as const,
  },
  {
    href: "/customer/ai-tools",
    title: "AI Tools",
    text: "Write, edit and create",
    icon: <IconAiTools width={24} height={24} />,
    tone: "lavender" as const,
  },
  {
    href: "/colors",
    title: "Color Studio",
    text: "Explore palettes",
    icon: <IconColorStudio width={24} height={24} />,
    tone: "green" as const,
  },
];

export default function CustomerHomePage() {
  const [state, setState] = useState<HomeState>({ status: "loading" });
  const [recentFilter, setRecentFilter] = useState<RecentFilter>("all");
  const [recapOpen, setRecapOpen] = useState(false);

  const [liveTick, setLiveTick] = useState(0);
  const liveRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [settings, tokens, board, drafts, moodboards, list] = await Promise.all([
          readJson<CustomerSettingsResponse>("/api/customer/settings", "Settings"),
          readJson<CustomerTokensResponse>("/api/customer/tokens", "Tokens"),
          readJson<CustomerBoardResponse>("/api/customer/board", "Board"),
          readOptional<DraftsResponse>("/api/customer/ticket-drafts"),
          readOptional<MoodboardsResponse>("/api/moodboards"),
          readOptional<TicketListResponse>("/api/customer/tickets?limit=100"),
        ]);
        if (cancelled) return;
        const thumbnails: Record<string, string> = {};
        for (const t of list?.tickets ?? []) if (t.thumbnailUrl) thumbnails[t.id] = t.thumbnailUrl;
        setState({
          status: "ready",
          // Read in the browser with the data: the server can't know the customer's time of day.
          now: new Date(),
          data: {
            settings,
            tokens,
            board,
            thumbnails,
            drafts: (drafts?.drafts ?? []).map((d) => ({
              id: d.id,
              title: d.title ?? "",
              updatedAt: d.updatedAt,
              fileCount: d.attachments?.length ?? 0,
            })),
            moodboards: (moodboards?.moodboards ?? []).map((m) => ({
              id: m.id,
              title: m.title,
              updatedAt: m.updatedAt,
            })),
          },
        });
      } catch (err) {
        if (liveRef.current) return; // background refresh: keep what's on screen
        console.error("[CustomerHome] load error", err);
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
  const companyRole = normalizeCompanyRole(data?.settings.user.companyRole ?? null);
  const canCreate = canCreateTickets(companyRole);
  const balance = data?.tokens.company.tokenBalance ?? null;
  const lowBalance = balance != null && balance < LOW_BALANCE_TOKENS;
  const stats = data?.board.stats ?? null;
  const open = (stats?.total ?? 0) - (stats?.byStatus.DONE ?? 0);
  const firstName = data?.settings.user.name?.trim().split(/\s+/)[0] ?? null;

  const tickets = useMemo<HomeTicket[]>(
    () =>
      (data?.board.tickets ?? []).map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        dueDate: t.dueDate,
        createdAt: t.createdAt ?? null,
        updatedAt: t.updatedAt ?? null,
        service: t.jobType?.name ?? null,
        code: buildTicketCode({
          projectCode: t.project?.code,
          companyTicketNumber: t.companyTicketNumber,
          ticketId: t.id,
        }),
      })),
    [data],
  );

  const reminders = useMemo(
    () =>
      data && now
        ? customerReminders({
            tickets,
            drafts: data.drafts,
            balance,
            canReview: canEditTickets(companyRole),
            canCreate,
            now,
          })
        : [],
    [data, now, tickets, balance, companyRole, canCreate],
  );
  const attention: AttentionItem[] = reminders.slice(0, REMINDER_LIMIT).map((r) => ({
    key: r.key,
    title: r.title,
    detail: r.detail,
    badge: r.badge,
    action: r.action,
    thumbnailUrl: r.ticketId ? data?.thumbnails[r.ticketId] : null,
    tone: r.kind === "lowTokens" ? "amber" : r.kind === "draft" ? "neutral" : "peach",
    icon:
      r.kind === "lowTokens" ? <IconCoins /> : r.kind === "draft" ? <IconDocument /> : undefined,
  }));

  const recent = useMemo<RecentCard[]>(() => {
    if (!data || !now) return [];
    return recentWork({
      role: "customer",
      tickets,
      drafts: recentFilter === "all" && canCreate ? data.drafts : [],
      moodboards: recentFilter === "all" ? data.moodboards : [],
      now,
    }).map((item) => ({
      key: item.key,
      title: item.title,
      href: item.href,
      badge: item.badge,
      detail: item.detail,
      thumbnailUrl: item.ticketId ? data.thumbnails[item.ticketId] : null,
      tone: item.kind === "moodboard" ? "lavender" : item.kind === "draft" ? "neutral" : "peach",
      icon:
        item.kind === "moodboard" ? (
          <IconMoodboards width={24} height={24} />
        ) : item.kind === "draft" ? (
          <IconDocument />
        ) : undefined,
    }));
  }, [data, now, tickets, recentFilter, canCreate]);

  const suggestion = useMemo(
    () => (data && now ? customerSuggestion({ tickets, canCreate, now }) : null),
    [data, now, tickets, canCreate],
  );

  const slot = useHeroSlot();
  const greeting = slot ? HERO_GREETING[slot] : "Welcome";

  return (
    <>
      <HomeHero
        slot={slot}
        loading={state.status === "loading"}
        date={
          now
            ? now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
            : null
        }
        title={firstName ? `${greeting}, ${firstName}.` : `${greeting}.`}
        tagline="Your next great idea starts here."
        stats={
          data ? (
            <>
              <HeroStat icon={<IconTicket />} tone="green" href="/customer/board">
                {fmt(open)} open {plural(open, "request", "requests")}
              </HeroStat>
              <HeroStat icon={<IconCoins />} tone={lowBalance ? "amber" : "peach"}>
                {fmt(balance)} {plural(balance ?? 0, "token", "tokens")} left
                {lowBalance ? " · Low balance" : ""}
              </HeroStat>
              <ArrowLink href="/customer/tokens">Balance</ArrowLink>
            </>
          ) : null
        }
        actions={
          data ? (
            <>
              {canCreate ? (
                <ButtonLink href="/customer/tickets/new" variant="primary">
                  <IconPlus />
                  New request
                </ButtonLink>
              ) : null}
              {canBookConsultation(companyRole) ? (
                <ButtonLink href="/customer/consultation">
                  <IconConsultation width={18} height={18} />
                  Book a consultation
                </ButtonLink>
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
          <Skeleton className="h-56" />
        </div>
      ) : (
        <div className="space-y-6">
          <ShortcutCards items={SHORTCUTS} />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,5fr)] [&>*:only-child]:lg:col-span-2">
            <AttentionList
              title="Needs your attention"
              items={attention}
              total={reminders.length}
              empty={
                <div className="flex flex-col items-center px-4 pt-6 pb-2 text-center">
                  <IconTile tone="green" size={48} round>
                    <IconCheck />
                  </IconTile>
                  <p className="mt-3 text-base font-semibold">You’re all caught up</p>
                  <p className="mt-1 max-w-sm text-sm text-[var(--av2-text-2)]">
                    Work to review, unfinished drafts and due dates show up here.
                  </p>
                </div>
              }
              footer={
                reminders.length > attention.length ? (
                  <p className="mt-3 text-sm text-[var(--av2-text-2)]">
                    And {reminders.length - attention.length} more.{" "}
                    <TextLink href="/customer/board" arrow={false}>
                      Open board
                    </TextLink>
                  </p>
                ) : null
              }
            />
            <BrandReadyCard />
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] [&>*:only-child]:lg:col-span-2">
            <section className="min-w-0 rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[22px] leading-7 font-semibold">Recent work</h2>
                <FilterChips<RecentFilter>
                  label="Filter recent work"
                  options={[
                    { value: "all", label: "All" },
                    { value: "requests", label: "Requests" },
                  ]}
                  value={recentFilter}
                  onChange={setRecentFilter}
                />
              </div>
              {recent.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--av2-text-2)]">
                  {recentFilter === "requests"
                    ? "No open requests yet."
                    : "Requests, drafts and moodboards you work on show up here."}
                </p>
              ) : (
                <RecentCards items={recent} />
              )}
            </section>
            <RecapMiniCard open={recapOpen} onToggle={() => setRecapOpen((v) => !v)} />
          </div>

          {recapOpen ? <MonthlyRecapCard /> : null}

          {suggestion ? (
            <section
              aria-label="Suggested for you"
              className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-[#e2dbf7] bg-[var(--av2-lavender-bg)] px-6 py-4 dark:border-[#352d57]"
            >
              <p className="text-lg font-semibold">{suggestion.title}</p>
              <p className="min-w-[200px] flex-1 text-[15px]">{suggestion.reason}</p>
              <TextLink href={suggestion.action.href} arrow={false}>
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  {suggestion.action.label}
                  <IconArrowRight width={16} height={16} />
                </span>
              </TextLink>
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
