// -----------------------------------------------------------------------------
// @file: tests/integration/meetings.test.ts
// @purpose: Public meeting booking against a real database: double-booking
//           protection, failing closed when the calendar can't be read, releasing
//           a slot when Google fails, and the manage link as the only credential.
// -----------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockBusy, mockCreate, mockCancel, mockEmail, mockGetUser } = vi.hoisted(() => ({
  mockBusy: vi.fn(),
  mockCreate: vi.fn(),
  mockCancel: vi.fn(),
  mockEmail: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock("@/lib/google/calendar", () => ({
  queryBusyStrict: mockBusy,
  createConsultationEvent: mockCreate,
  cancelConsultationEvent: mockCancel,
  extractMeetLink: (event: { hangoutLink?: string }) => event.hangoutLink ?? null,
}));
vi.mock("@/lib/email", () => ({ sendNotificationEmail: mockEmail }));
vi.mock("@/lib/rate-limit", () => ({
  getClientIp: () => "203.0.113.1",
  rateLimit: async () => ({ allowed: true, resetAt: Date.now() + 1000 }),
}));
vi.mock("@/lib/turnstile", () => ({
  verifyTurnstileToken: async () => ({ ok: true }),
  turnstileErrorMessage: () => "Bot check failed",
}));
vi.mock("@/lib/auth", () => ({ getCurrentUserOrThrow: () => mockGetUser() }));

import { DELETE as adminCancel } from "@/app/api/admin/meetings/[id]/route";
import { GET as adminList } from "@/app/api/admin/meetings/route";
import { GET as getAvailability } from "@/app/api/meetings/availability/route";
import { POST as book } from "@/app/api/meetings/route";
import {
  DELETE as cancel,
  GET as view,
  PATCH as reschedule,
} from "@/app/api/meetings/[token]/route";
import { hashManageToken, MEETING_HOST_EMAIL } from "@/lib/meetings/service";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "./helpers/db";
import { createUser } from "./helpers/fixtures";

const get = (url = "http://localhost/test") => new NextRequest(url);
const send = (method: string, body?: unknown) =>
  new NextRequest("http://localhost/test", {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (token: string) => ({ params: Promise.resolve({ token }) });

async function connectCalendar(accountEmail = MEETING_HOST_EMAIL) {
  await prisma.consultationSettings.create({
    data: {
      singleton: true,
      googleRefreshToken: "refresh",
      googleAccountEmail: accountEmail,
      companyTimezone: "UTC",
    },
  });
}

async function openSlots(): Promise<string[]> {
  const json = await (await getAvailability(get())).json();
  return json.slots;
}

const visitor = (startsAt: string, email = "ada@test.local") => ({
  name: "Ada",
  email,
  company: "Acme",
  note: "Please call me back about something unrelated",
  timezone: "Europe/Istanbul",
  startsAt,
});

async function bookFirst() {
  const [slot] = await openSlots();
  const res = await book(send("POST", visitor(slot)));
  expect(res.status).toBe(201);
  const { token } = await res.json();
  return { slot, token: token as string };
}

beforeEach(async () => {
  await resetDatabase();
  vi.clearAllMocks();
  mockBusy.mockResolvedValue([]);
  mockCancel.mockResolvedValue(undefined);
  mockEmail.mockResolvedValue(undefined);
  mockCreate.mockResolvedValue({ id: "evt_1", hangoutLink: "https://meet.google.com/abc" });
});

describe("availability", () => {
  it("offers no times, not all times, when the calendar isn't connected", async () => {
    await prisma.consultationSettings.create({ data: { singleton: true } });
    const json = await (await getAvailability(get())).json();
    expect(json).toEqual({ available: false, slots: [] });
  });

  it("offers no times when a calendar can't be read", async () => {
    await connectCalendar();
    mockBusy.mockRejectedValue(new Error("notFound"));
    const json = await (await getAvailability(get())).json();
    expect(json).toEqual({ available: false, slots: [] });
  });

  it("removes times that are busy on the calendar", async () => {
    await connectCalendar();
    const [first, second] = await openSlots();
    mockBusy.mockResolvedValue([{ start: first, end: second }]);
    const slots = await openSlots();
    expect(slots).not.toContain(first);
    expect(slots).toContain(second);
  });

  it("checks the host's calendar too when another account is connected", async () => {
    await connectCalendar("team@brandbite.studio");
    await openSlots();
    expect(mockBusy.mock.calls[0][1]).toEqual(["primary", MEETING_HOST_EMAIL]);
  });

  it("reveals only start times", async () => {
    await connectCalendar();
    mockBusy.mockResolvedValue([
      {
        start: new Date(Date.now() + 2 * 864e5).toISOString(),
        end: new Date(Date.now() + 3 * 864e5).toISOString(),
      },
    ]);
    const json = await (await getAvailability(get())).json();
    expect(Object.keys(json).sort()).toEqual(["available", "slots"]);
  });
});

describe("booking", () => {
  beforeEach(() => connectCalendar());

  it("books a slot, invites the host, and removes the slot", async () => {
    const { slot } = await bookFirst();
    const meeting = await prisma.meeting.findFirstOrThrow();
    expect(meeting.startsAt.toISOString()).toBe(slot);
    expect(meeting.status).toBe("CONFIRMED");
    expect(meeting.videoLink).toBe("https://meet.google.com/abc");
    expect(await openSlots()).not.toContain(slot);
  });

  it("stores only a hash of the manage token", async () => {
    const { token } = await bookFirst();
    const meeting = await prisma.meeting.findFirstOrThrow();
    expect(meeting.manageTokenHash).toBe(hashManageToken(token));
    expect(JSON.stringify(meeting)).not.toContain(token);
  });

  it("emails both the visitor and the host", async () => {
    await bookFirst();
    expect(mockEmail.mock.calls.map((call) => call[0]).sort()).toEqual(
      ["ada@test.local", MEETING_HOST_EMAIL].sort(),
    );
  });

  it("keeps the visitor's text out of the calendar invite", async () => {
    await bookFirst();
    const invite = mockCreate.mock.calls[0][1];
    expect(JSON.stringify(invite)).not.toContain("unrelated");
    expect(JSON.stringify(invite)).not.toContain("Acme");
  });

  it("shows the note to the host only", async () => {
    await bookFirst();
    const html = (to: string) => mockEmail.mock.calls.find((call) => call[0] === to)?.[2];
    expect(html(MEETING_HOST_EMAIL)).toContain("unrelated");
    expect(html("ada@test.local")).not.toContain("unrelated");
  });

  it("adds the host as attendee only when another account is connected", async () => {
    await bookFirst();
    expect(mockCreate.mock.calls[0][1].attendeeEmails).toEqual(["ada@test.local"]);
  });

  it("gives a slot to only one of two simultaneous bookings", async () => {
    const [slot] = await openSlots();
    const results = await Promise.all([
      book(send("POST", visitor(slot, "a@test.local"))),
      book(send("POST", visitor(slot, "b@test.local"))),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.meeting.count()).toBe(1);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("releases the slot if Google fails", async () => {
    const [slot] = await openSlots();
    mockCreate.mockRejectedValueOnce(new Error("Google down"));
    const res = await book(send("POST", visitor(slot)));
    expect(res.status).toBe(502);
    expect(await prisma.meeting.count()).toBe(0);
    expect(mockEmail).not.toHaveBeenCalled();
    expect(await openSlots()).toContain(slot);
  });

  it("still confirms when an email fails", async () => {
    mockEmail.mockRejectedValue(new Error("Resend down"));
    await bookFirst();
    expect(await prisma.meeting.count()).toBe(1);
  });

  it("refuses a time that isn't offered", async () => {
    const outside = new Date(Date.now() + 2 * 864e5);
    outside.setUTCHours(3, 7, 0, 0);
    const res = await book(send("POST", visitor(outside.toISOString())));
    expect(res.status).toBe(409);
    expect(await prisma.meeting.count()).toBe(0);
  });

  it("refuses a booking when the calendar can't be read", async () => {
    const [slot] = await openSlots();
    mockBusy.mockRejectedValue(new Error("notFound"));
    const res = await book(send("POST", visitor(slot)));
    expect(res.status).toBe(503);
    expect(await prisma.meeting.count()).toBe(0);
  });

  it.each([
    ["no name", { name: " " }],
    ["a bad email", { email: "nope" }],
    ["a bad time", { startsAt: "soon" }],
    ["a long note", { note: "x".repeat(1001) }],
  ])("rejects %s", async (_label, change) => {
    const [slot] = await openSlots();
    const res = await book(send("POST", { ...visitor(slot), ...change }));
    expect(res.status).toBe(400);
    expect(await prisma.meeting.count()).toBe(0);
  });
});

describe("manage link", () => {
  beforeEach(() => connectCalendar());

  it("shows the meeting without private fields", async () => {
    const { token, slot } = await bookFirst();
    const { meeting } = await (await view(get(), ctx(token))).json();
    expect(meeting.startsAt).toBe(slot);
    expect(Object.keys(meeting).sort()).toEqual(["name", "startsAt", "status", "videoLink"]);
  });

  it("rejects an unknown token on every action", async () => {
    await bookFirst();
    const [slot] = await openSlots();
    expect((await view(get(), ctx("wrong"))).status).toBe(404);
    expect((await reschedule(send("PATCH", { startsAt: slot }), ctx("wrong"))).status).toBe(404);
    expect((await cancel(send("DELETE"), ctx("wrong"))).status).toBe(404);
    expect((await prisma.meeting.findFirstOrThrow()).status).toBe("CONFIRMED");
  });

  it("cancels, frees the slot, and removes the event", async () => {
    const { token, slot } = await bookFirst();
    const res = await cancel(send("DELETE"), ctx(token));
    expect(res.status).toBe(200);
    expect(mockCancel).toHaveBeenCalledWith(expect.anything(), "primary", "evt_1");
    const meeting = await prisma.meeting.findFirstOrThrow();
    expect(meeting.status).toBe("CANCELED");
    expect(meeting.activeSlot).toBeNull();
    expect(await openSlots()).toContain(slot);
  });

  it("keeps the meeting if Google can't cancel the event", async () => {
    const { token } = await bookFirst();
    mockCancel.mockRejectedValueOnce(new Error("Google down"));
    expect((await cancel(send("DELETE"), ctx(token))).status).toBe(502);
    expect((await prisma.meeting.findFirstOrThrow()).status).toBe("CONFIRMED");
  });

  it("refuses to change a canceled meeting", async () => {
    const { token } = await bookFirst();
    await cancel(send("DELETE"), ctx(token));
    expect((await cancel(send("DELETE"), ctx(token))).status).toBe(409);
    const [slot] = await openSlots();
    expect((await reschedule(send("PATCH", { startsAt: slot }), ctx(token))).status).toBe(409);
  });

  it("moves to a new time, replacing the event and freeing the old slot", async () => {
    const { token, slot } = await bookFirst();
    const next = (await openSlots())[1];
    mockCreate.mockResolvedValueOnce({ id: "evt_2", hangoutLink: "https://meet.google.com/new" });
    const res = await reschedule(send("PATCH", { startsAt: next }), ctx(token));
    expect(res.status).toBe(200);
    expect(mockCancel).toHaveBeenCalledWith(expect.anything(), "primary", "evt_1");
    const meeting = await prisma.meeting.findFirstOrThrow();
    expect(meeting.startsAt.toISOString()).toBe(next);
    expect(meeting.googleEventId).toBe("evt_2");
    expect(await openSlots()).toContain(slot);
    expect(await openSlots()).not.toContain(next);
  });

  it("keeps the original time if Google fails while rescheduling", async () => {
    const { token, slot } = await bookFirst();
    const next = (await openSlots())[1];
    mockCreate.mockRejectedValueOnce(new Error("Google down"));
    expect((await reschedule(send("PATCH", { startsAt: next }), ctx(token))).status).toBe(502);
    const meeting = await prisma.meeting.findFirstOrThrow();
    expect(meeting.startsAt.toISOString()).toBe(slot);
    expect(meeting.activeSlot?.toISOString()).toBe(slot);
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it("refuses to move onto a booked time", async () => {
    const { token } = await bookFirst();
    const taken = (await openSlots())[0];
    await book(send("POST", visitor(taken, "b@test.local")));
    expect((await reschedule(send("PATCH", { startsAt: taken }), ctx(token))).status).toBe(409);
  });
});

describe("admin", () => {
  beforeEach(() => connectCalendar());

  it("is limited to site admins", async () => {
    const { id } = await createUser({ role: "CUSTOMER" });
    mockGetUser.mockResolvedValue({ id, email: "c@test.local", role: "CUSTOMER" });
    expect((await adminList()).status).toBe(403);
    expect(
      (await adminCancel(send("DELETE"), { params: Promise.resolve({ id: "x" }) })).status,
    ).toBe(403);
  });

  it("lists meetings with calendar status and never exposes the token hash", async () => {
    await bookFirst();
    const { id } = await createUser({ role: "SITE_OWNER" });
    mockGetUser.mockResolvedValue({ id, email: "o@test.local", role: "SITE_OWNER" });
    const json = await (await adminList()).json();
    expect(json.meetings).toHaveLength(1);
    expect(json.calendar.connected).toBe(true);
    expect(json.calendar.hostEmail).toBe(MEETING_HOST_EMAIL);
    expect(JSON.stringify(json)).not.toContain("manageTokenHash");
    expect(JSON.stringify(json)).not.toContain("refresh");
  });

  it("cancels a meeting", async () => {
    await bookFirst();
    const meeting = await prisma.meeting.findFirstOrThrow();
    const { id } = await createUser({ role: "SITE_ADMIN" });
    mockGetUser.mockResolvedValue({ id, email: "a@test.local", role: "SITE_ADMIN" });
    const res = await adminCancel(send("DELETE"), { params: Promise.resolve({ id: meeting.id }) });
    expect(res.status).toBe(200);
    expect((await prisma.meeting.findFirstOrThrow()).status).toBe("CANCELED");
  });
});
