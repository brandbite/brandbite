import { describe, expect, it } from "vitest";

import { HERO_GREETING, heroSlot, resolveHeroSlot } from "../hero";
import {
  creativeMoves,
  customerReminders,
  customerSuggestion,
  RECENT_LIMIT,
  recentWork,
  timeAgo,
  type HomeDraft,
  type HomeTicket,
} from "../home";

const NOW = new Date("2026-11-25T10:00:00.000Z");
const day = (offset: number) => new Date(NOW.getTime() + offset * 86_400_000).toISOString();

function ticket(overrides: Partial<HomeTicket>): HomeTicket {
  return {
    id: "t1",
    title: "Logo redesign",
    status: "IN_PROGRESS",
    dueDate: null,
    updatedAt: day(-1),
    code: "WEB-1",
    ...overrides,
  };
}

const draft = (overrides: Partial<HomeDraft> = {}): HomeDraft => ({
  id: "d1",
  title: "Packaging label",
  updatedAt: day(-3),
  fileCount: 2,
  ...overrides,
});

function reminders(input: Partial<Parameters<typeof customerReminders>[0]>) {
  return customerReminders({
    tickets: [],
    drafts: [],
    balance: 50,
    canReview: true,
    canCreate: true,
    now: NOW,
    ...input,
  });
}

describe("customerReminders", () => {
  it("orders review, overdue, drafts, due soon, then low tokens", () => {
    const list = reminders({
      balance: 2,
      drafts: [draft()],
      tickets: [
        ticket({ id: "soon", dueDate: day(2) }),
        ticket({ id: "late", dueDate: day(-2) }),
        ticket({ id: "rev", status: "IN_REVIEW" }),
      ],
    });
    expect(list.map((r) => r.kind)).toEqual(["review", "overdue", "draft", "dueSoon", "lowTokens"]);
    expect(list.map((r) => r.badge?.label)).toEqual([
      "Ready for review",
      "Past due date",
      undefined,
      "Due soon",
      undefined,
    ]);
  });

  it("names the request, links to it and keeps its id for the picture", () => {
    const list = reminders({
      drafts: [draft()],
      tickets: [ticket({ id: "rev", status: "IN_REVIEW" })],
    });
    expect(list[0]).toMatchObject({
      title: "Logo redesign",
      detail: "WEB-1 · Waiting for your approval",
      action: { label: "Review", href: "/customer/tickets/rev" },
      ticketId: "rev",
    });
    expect(list[1]).toMatchObject({
      title: "Packaging label",
      detail: "Draft · Saved 3 days ago · 2 files",
      action: { label: "Continue", href: "/customer/tickets/new?draft=d1" },
    });
  });

  it("leaves out done requests and requests with no due date", () => {
    const list = reminders({
      tickets: [ticket({ id: "done", status: "DONE", dueDate: day(-5) }), ticket({ id: "calm" })],
    });
    expect(list).toEqual([]);
  });

  it("does not count a request in review as overdue as well", () => {
    const list = reminders({
      tickets: [ticket({ id: "rev", status: "IN_REVIEW", dueDate: day(-1) })],
    });
    expect(list.map((r) => r.kind)).toEqual(["review"]);
  });

  it("follows the company role", () => {
    const input = { drafts: [draft()], tickets: [ticket({ status: "IN_REVIEW" as const })] };
    expect(reminders({ ...input, canReview: false, canCreate: false })).toEqual([]);
  });

  it("flags tokens only under the threshold, and names an untitled draft", () => {
    expect(reminders({ balance: 5 })).toEqual([]);
    expect(reminders({ balance: 1 })[0].detail).toBe("1 token left");
    expect(reminders({ balance: null })).toEqual([]);
    expect(reminders({ drafts: [draft({ title: "  ", fileCount: 0 })] })[0]).toMatchObject({
      title: "Untitled request",
      detail: "Draft · Saved 3 days ago",
    });
  });
});

describe("creativeMoves", () => {
  it("puts revisions first, then work in progress by due date, new work, then work in review", () => {
    const moves = creativeMoves([
      ticket({ id: "review", status: "IN_REVIEW", revisionRequested: true }),
      ticket({ id: "new", status: "TODO", dueDate: day(1) }),
      ticket({ id: "later", dueDate: day(9) }),
      ticket({ id: "undated" }),
      ticket({ id: "sooner", dueDate: day(2) }),
      ticket({ id: "fix", revisionRequested: true }),
      ticket({ id: "done", status: "DONE" }),
    ]);
    expect(moves.map((m) => m.ticketId)).toEqual([
      "fix",
      "sooner",
      "later",
      "undated",
      "new",
      "review",
    ]);
    expect(moves.map((m) => m.action.label)).toEqual([
      "Open",
      "Continue",
      "Continue",
      "Continue",
      "View brief",
      "Open",
    ]);
    expect(moves[0].badge?.label).toBe("Revision requested");
    expect(moves[5].badge?.label).toBe("With the customer");
    expect(moves[0].action.href).toBe("/creative/tickets/fix");
  });
});

describe("recentWork", () => {
  it("mixes requests, drafts and moodboards, newest first, and stops at the limit", () => {
    const items = recentWork({
      role: "customer",
      now: NOW,
      tickets: [
        ticket({ id: "a", updatedAt: day(-4) }),
        ticket({ id: "b", updatedAt: day(-0.1) }),
        ticket({ id: "done", status: "DONE", updatedAt: day(-0.01) }),
        ticket({ id: "undated", updatedAt: null }),
      ],
      drafts: [draft({ updatedAt: day(-2) })],
      moodboards: [
        { id: "m1", title: "Winter campaign", updatedAt: day(-1) },
        { id: "m2", title: "Old board", updatedAt: day(-30) },
      ],
    });
    expect(items).toHaveLength(RECENT_LIMIT);
    expect(items.map((i) => i.key)).toEqual(["request-b", "moodboard-m1", "draft-d1"]);
    expect(items[0].badge).toEqual({ label: "In progress", tone: "lavender" });
    expect(items[1]).toMatchObject({
      href: "/customer/moodboards/m1",
      detail: "Edited yesterday",
    });
  });

  it("links a creative to their own pages", () => {
    const items = recentWork({
      role: "creative",
      now: NOW,
      tickets: [ticket({ id: "a" })],
      moodboards: [{ id: "m1", title: "Directions", updatedAt: day(-2) }],
    });
    expect(items.map((i) => i.href)).toEqual(["/creative/tickets/a", "/creative/moodboards/m1"]);
  });
});

describe("customerSuggestion", () => {
  const monthly = (months: number[]) =>
    months.map((back, i) =>
      ticket({
        id: `s${i}`,
        service: "Social media set",
        createdAt: new Date(2026, 10 - back, 3).toISOString(),
      }),
    );
  const at = new Date(2026, 10, 25);

  it("suggests a service asked for in each of the last three months", () => {
    expect(customerSuggestion({ tickets: monthly([1, 2, 3]), canCreate: true, now: at })).toEqual({
      key: "monthly-Social media set",
      title: "Plan your November social media set",
      reason: "Based on your last three monthly requests.",
      action: { label: "Start a request", href: "/customer/tickets/new" },
    });
  });

  it("stays quiet when a month is missing, this month is done, or the role can't create", () => {
    expect(
      customerSuggestion({ tickets: monthly([1, 3, 4]), canCreate: true, now: at }),
    ).toBeNull();
    expect(
      customerSuggestion({ tickets: monthly([0, 1, 2, 3]), canCreate: true, now: at }),
    ).toBeNull();
    expect(
      customerSuggestion({ tickets: monthly([1, 2, 3]), canCreate: false, now: at }),
    ).toBeNull();
  });
});

describe("time helpers", () => {
  it("picks the banner slot by the hour", () => {
    const at = (hour: number) => heroSlot(new Date(2026, 10, 25, hour));
    expect([at(4), at(5), at(11), at(12), at(16), at(17), at(20), at(21), at(0)]).toEqual([
      "night",
      "morning",
      "morning",
      "afternoon",
      "afternoon",
      "evening",
      "evening",
      "night",
      "night",
    ]);
    expect(HERO_GREETING.night).toBe("Good evening");
  });

  it("lets the address pick a slot, and ignores one it doesn't know", () => {
    const morning = new Date(2026, 10, 25, 9);
    expect(resolveHeroSlot(morning, "?hero=night")).toBe("night");
    expect(resolveHeroSlot(morning, "?hero=brunch")).toBe("morning");
    expect(resolveHeroSlot(morning, "")).toBe("morning");
  });

  it("describes how long ago something happened", () => {
    expect(timeAgo(day(-1), NOW)).toBe("yesterday");
    expect(timeAgo(new Date(NOW.getTime() - 20_000).toISOString(), NOW)).toBe("just now");
    expect(timeAgo("not a date", NOW)).toBe("");
  });
});
