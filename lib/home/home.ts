// -----------------------------------------------------------------------------
// @file: lib/home/home.ts
// @purpose: What the dashboard Home shows, worked out from data the pages
//           already load: the reminders ("Needs your attention", "Your next
//           moves"), recent work and the one suggestion. Pure functions, so
//           the rules are tested without rendering.
// -----------------------------------------------------------------------------

import { formatDueDateCountdown, isDueDateOverdue, isDueDateSoon } from "@/lib/board";

/** Matches the admin dashboard's definition of a low-balance company. */
export const LOW_BALANCE_TOKENS = 5;
/** Most reminders shown at once; the count still shows them all. */
export const REMINDER_LIMIT = 5;
export const RECENT_LIMIT = 3;

export type HomeStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
export type BadgeTone = "neutral" | "lavender" | "peach" | "green" | "red" | "amber";

export type HomeTicket = {
  id: string;
  title: string;
  status: HomeStatus;
  dueDate: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  /** Display code, e.g. "WEB-12". */
  code: string;
  /** Service name, e.g. "Social media set". */
  service?: string | null;
  /** Creative side: the customer asked for changes on the latest revision. */
  revisionRequested?: boolean;
};

export type HomeDraft = { id: string; title: string; updatedAt: string; fileCount: number };
export type HomeMoodboard = { id: string; title: string; updatedAt: string };

export type ReminderKind =
  | "review"
  | "overdue"
  | "draft"
  | "dueSoon"
  | "lowTokens"
  | "revision"
  | "inProgress"
  | "assigned"
  | "waiting";

export type Reminder = {
  key: string;
  kind: ReminderKind;
  title: string;
  detail: string;
  badge?: { label: string; tone: BadgeTone };
  action: { label: string; href: string };
  /** The request behind the reminder, for its picture. */
  ticketId?: string;
};

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
  ["week", 7 * 24 * 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
];

/** "2 days ago", "3 hours ago", "just now". */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = then - now.getTime();
  const format = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return format.format(Math.round(diff / ms), unit);
  }
  return "just now";
}

function draftTitle(draft: HomeDraft): string {
  return draft.title.trim() || "Untitled request";
}

const byDue = (a: HomeTicket, b: HomeTicket) =>
  new Date(a.dueDate ?? 0).getTime() - new Date(b.dueDate ?? 0).getTime();

/** "WEB-12 · 2 days left"; just the code when there is no due date. */
function codeAndDue(ticket: HomeTicket): string {
  return [ticket.code, formatDueDateCountdown(ticket.dueDate)?.label].filter(Boolean).join(" · ");
}

/**
 * A customer's reminders, most pressing first: work waiting for their review,
 * overdue requests, unfinished drafts, requests due within three days, then a
 * low token balance. `canReview` and `canCreate` follow the company role.
 */
export function customerReminders({
  tickets,
  drafts,
  balance,
  canReview,
  canCreate,
  now = new Date(),
}: {
  tickets: HomeTicket[];
  drafts: HomeDraft[];
  balance: number | null;
  canReview: boolean;
  canCreate: boolean;
  now?: Date;
}): Reminder[] {
  const open = tickets.filter((t) => t.status !== "DONE");
  const reminders: Reminder[] = [];

  if (canReview) {
    for (const t of open.filter((t) => t.status === "IN_REVIEW")) {
      reminders.push({
        key: `review-${t.id}`,
        kind: "review",
        title: t.title,
        detail: `${t.code} · Waiting for your approval`,
        badge: { label: "Ready for review", tone: "green" },
        action: { label: "Review", href: `/customer/tickets/${t.id}` },
        ticketId: t.id,
      });
    }
  }

  const waiting = open.filter((t) => t.status !== "IN_REVIEW");
  for (const t of waiting.filter((t) => isDueDateOverdue(t.dueDate, now.getTime())).sort(byDue)) {
    reminders.push({
      key: `overdue-${t.id}`,
      kind: "overdue",
      title: t.title,
      detail: codeAndDue(t),
      badge: { label: "Past due date", tone: "red" },
      action: { label: "Open", href: `/customer/tickets/${t.id}` },
      ticketId: t.id,
    });
  }

  if (canCreate) {
    for (const draft of drafts) {
      const files =
        draft.fileCount > 0
          ? ` · ${draft.fileCount} ${draft.fileCount === 1 ? "file" : "files"}`
          : "";
      reminders.push({
        key: `draft-${draft.id}`,
        kind: "draft",
        title: draftTitle(draft),
        detail: `Draft · Saved ${timeAgo(draft.updatedAt, now)}${files}`,
        action: { label: "Continue", href: `/customer/tickets/new?draft=${draft.id}` },
      });
    }
  }

  for (const t of waiting.filter((t) => isDueDateSoon(t.dueDate, now.getTime())).sort(byDue)) {
    reminders.push({
      key: `due-${t.id}`,
      kind: "dueSoon",
      title: t.title,
      detail: codeAndDue(t),
      badge: { label: "Due soon", tone: "amber" },
      action: { label: "Open", href: `/customer/tickets/${t.id}` },
      ticketId: t.id,
    });
  }

  if (balance != null && balance < LOW_BALANCE_TOKENS) {
    reminders.push({
      key: "low-tokens",
      kind: "lowTokens",
      title: "Tokens are running low",
      detail: `${balance} ${balance === 1 ? "token" : "tokens"} left`,
      action: { label: "View tokens", href: "/customer/tokens" },
    });
  }

  return reminders;
}

/**
 * A creative's open requests in the order to act on them: revisions the
 * customer asked for, work in progress (soonest due first), new assignments,
 * then work waiting on the customer's review.
 */
export function creativeMoves(tickets: HomeTicket[]): Reminder[] {
  const open = tickets.filter((t) => t.status !== "DONE");
  const rank = (t: HomeTicket) =>
    t.revisionRequested && t.status !== "IN_REVIEW"
      ? 0
      : t.status === "IN_PROGRESS"
        ? 1
        : t.status === "TODO"
          ? 2
          : 3;
  const noDueLast = (t: HomeTicket) => (t.dueDate ? new Date(t.dueDate).getTime() : Infinity);

  return [...open]
    .sort((a, b) => rank(a) - rank(b) || noDueLast(a) - noDueLast(b))
    .map((t) => {
      const href = `/creative/tickets/${t.id}`;
      const base = { key: `move-${t.id}`, title: t.title, detail: codeAndDue(t), ticketId: t.id };
      switch (rank(t)) {
        case 0:
          return {
            ...base,
            kind: "revision" as const,
            badge: { label: "Revision requested", tone: "peach" as const },
            action: { label: "Open", href },
          };
        case 1:
          return {
            ...base,
            kind: "inProgress" as const,
            badge: { label: "In progress", tone: "lavender" as const },
            action: { label: "Continue", href },
          };
        case 2:
          return {
            ...base,
            kind: "assigned" as const,
            badge: { label: "New assignment", tone: "neutral" as const },
            action: { label: "View brief", href },
          };
        default:
          return {
            ...base,
            kind: "waiting" as const,
            badge: { label: "With the customer", tone: "green" as const },
            action: { label: "Open", href },
          };
      }
    });
}

export type RecentItem = {
  key: string;
  kind: "request" | "draft" | "moodboard";
  title: string;
  href: string;
  /** Requests show their status as a badge; the rest say when they were touched. */
  badge?: { label: string; tone: BadgeTone };
  detail?: string;
  updatedAt: string;
  ticketId?: string;
  moodboardId?: string;
};

export const STATUS_BADGE: Record<HomeStatus, { label: string; tone: BadgeTone }> = {
  TODO: { label: "Backlog", tone: "neutral" },
  IN_PROGRESS: { label: "In progress", tone: "lavender" },
  IN_REVIEW: { label: "In review", tone: "peach" },
  DONE: { label: "Done", tone: "green" },
};

/** The things someone touched last, newest first, across requests, drafts and moodboards. */
export function recentWork({
  role,
  tickets,
  drafts = [],
  moodboards,
  now = new Date(),
  limit = RECENT_LIMIT,
}: {
  role: "customer" | "creative";
  tickets: HomeTicket[];
  drafts?: HomeDraft[];
  moodboards: HomeMoodboard[];
  now?: Date;
  limit?: number;
}): RecentItem[] {
  const stamp = (t: HomeTicket) => t.updatedAt ?? t.createdAt ?? null;
  const items: RecentItem[] = [
    ...tickets
      .filter((t) => t.status !== "DONE" && stamp(t))
      .map((t) => ({
        key: `request-${t.id}`,
        kind: "request" as const,
        title: t.title,
        href: `/${role}/tickets/${t.id}`,
        badge: STATUS_BADGE[t.status],
        updatedAt: stamp(t)!,
        ticketId: t.id,
      })),
    ...drafts.map((d) => ({
      key: `draft-${d.id}`,
      kind: "draft" as const,
      title: draftTitle(d),
      href: `/customer/tickets/new?draft=${d.id}`,
      badge: { label: "Draft", tone: "amber" as const },
      updatedAt: d.updatedAt,
    })),
    ...moodboards.map((m) => ({
      key: `moodboard-${m.id}`,
      kind: "moodboard" as const,
      title: m.title,
      href: `/${role}/moodboards/${m.id}`,
      detail: `Edited ${timeAgo(m.updatedAt, now)}`,
      updatedAt: m.updatedAt,
      moodboardId: m.id,
    })),
  ];
  return items
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}

export type Suggestion = {
  key: string;
  title: string;
  reason: string;
  action: { label: string; href: string };
};

const monthKey = (date: Date) => date.getFullYear() * 12 + date.getMonth();

/**
 * The one suggestion a customer sees, or null. For now a single rule: a
 * service they asked for in each of the last three calendar months and not
 * yet this month.
 */
export function customerSuggestion({
  tickets,
  canCreate,
  now = new Date(),
}: {
  tickets: HomeTicket[];
  canCreate: boolean;
  now?: Date;
}): Suggestion | null {
  if (!canCreate) return null;
  const current = monthKey(now);
  const monthsByService = new Map<string, Set<number>>();
  for (const t of tickets) {
    if (!t.service || !t.createdAt) continue;
    const created = new Date(t.createdAt);
    if (Number.isNaN(created.getTime())) continue;
    const months = monthsByService.get(t.service) ?? new Set<number>();
    months.add(monthKey(created));
    monthsByService.set(t.service, months);
  }
  for (const [service, months] of monthsByService) {
    const lastThree = [1, 2, 3].every((back) => months.has(current - back));
    if (lastThree && !months.has(current)) {
      const month = now.toLocaleDateString("en-US", { month: "long" });
      return {
        key: `monthly-${service}`,
        title: `Plan your ${month} ${service.toLowerCase()}`,
        reason: "Based on your last three monthly requests.",
        action: { label: "Start a request", href: "/customer/tickets/new" },
      };
    }
  }
  return null;
}
