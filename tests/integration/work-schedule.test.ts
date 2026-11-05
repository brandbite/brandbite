// -----------------------------------------------------------------------------
// @file: tests/integration/work-schedule.test.ts
// @purpose: Creative working hours against a real Postgres: only valid schedules
//           are saved, admins hear about a creative's own changes, old notes
//           survive, and hours agreed at hire reach the new account.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGetUser, mockSendEmail } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockSendEmail: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUserOrThrow: () => mockGetUser(),
}));
vi.mock("@/lib/email", () => ({
  sendNotificationEmail: mockSendEmail,
}));
vi.mock("@/lib/better-auth", () => ({
  auth: { api: { signInMagicLink: vi.fn().mockResolvedValue({}) } },
}));

import { prisma } from "@/lib/prisma";
import { PATCH as patchProfile, GET as getProfile } from "@/app/api/profile/route";
import { PATCH as patchAdminUser } from "@/app/api/admin/users/route";
import { talentApplicationActionSchema } from "@/lib/schemas/talent-application.schemas";
import { onboardHiredTalent } from "@/lib/talent-onboarding";
import { defaultWorkSchedule, type WorkSchedule } from "@/lib/work-schedule";
import { resetDatabase } from "./helpers/db";
import { createUser } from "./helpers/fixtures";

function jsonReq(body: unknown) {
  return new NextRequest("http://localhost/test", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const schedule = (overrides: Partial<WorkSchedule["days"]> = {}): WorkSchedule => {
  const base = defaultWorkSchedule("Europe/Istanbul");
  return { ...base, days: { ...base.days, ...overrides } };
};

const scheduleNotifications = () =>
  prisma.notification.findMany({ where: { type: "CREATIVE_SCHEDULE_UPDATED" } });

let creative: { id: string; email: string };
let owner: { id: string };
let admin: { id: string };

function signIn(user: { id: string; email?: string }, role: string) {
  mockGetUser.mockResolvedValue({ id: user.id, email: user.email ?? "x@test.local", role });
}

beforeEach(async () => {
  await resetDatabase();
  mockGetUser.mockReset();
  mockSendEmail.mockReset();
  mockSendEmail.mockResolvedValue(undefined);
  creative = await prisma.userAccount.create({
    data: {
      authUserId: "auth-ada",
      email: "ada@test.local",
      name: "Ada Lane",
      role: "DESIGNER",
    },
  });
  await prisma.authUser.create({
    data: { id: "auth-ada", email: "ada@test.local", name: "Ada Lane", emailVerified: true },
  });
  owner = await createUser({ role: "SITE_OWNER" });
  admin = await createUser({ role: "SITE_ADMIN" });
});

describe("PATCH /api/profile", () => {
  it("saves each day's own hours and returns them", async () => {
    signIn(creative, "DESIGNER");
    const wanted = schedule({
      mon: { start: "08:00", end: "16:30" },
      wed: { start: "10:00", end: "14:00" },
      sat: { start: "11:00", end: "13:00" },
    });
    const res = await patchProfile(jsonReq({ workSchedule: wanted }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.workSchedule).toEqual(wanted);
    expect(body.user.workScheduleUpdatedAt).toEqual(expect.any(String));

    const reread = await (await getProfile()).json();
    expect(reread.user.workSchedule).toEqual(wanted);
  });

  it.each([
    ["free text", "9-18 weekdays"],
    ["an end before the start", schedule({ mon: { start: "18:00", end: "09:00" } })],
    ["an unknown zone", { ...schedule(), timezone: "Mars/Olympus" }],
    ["no working days", schedule({ mon: null, tue: null, wed: null, thu: null, fri: null })],
    ["null", null],
  ])("rejects %s and changes nothing", async (_name, workSchedule) => {
    signIn(creative, "DESIGNER");
    const res = await patchProfile(jsonReq({ workSchedule }));
    expect(res.status).toBe(400);
    const saved = await prisma.userAccount.findUniqueOrThrow({ where: { id: creative.id } });
    expect(saved.workSchedule).toBeNull();
    expect(await scheduleNotifications()).toEqual([]);
  });

  it("refuses anyone who isn't a creative", async () => {
    const customer = await createUser({ role: "CUSTOMER" });
    signIn(customer, "CUSTOMER");
    const res = await patchProfile(jsonReq({ workSchedule: schedule() }));
    expect(res.status).toBe(403);
  });

  it("no longer accepts the old free-text field", async () => {
    await prisma.userAccount.update({
      where: { id: creative.id },
      data: { workingHours: "old note" },
    });
    signIn(creative, "DESIGNER");
    await patchProfile(jsonReq({ workingHours: "changed" }));
    const saved = await prisma.userAccount.findUniqueOrThrow({ where: { id: creative.id } });
    expect(saved.workingHours).toBe("old note");
  });

  it("keeps the old note when a schedule is saved", async () => {
    await prisma.userAccount.update({
      where: { id: creative.id },
      data: { workingHours: "old note" },
    });
    signIn(creative, "DESIGNER");
    await patchProfile(jsonReq({ workSchedule: schedule() }));
    const saved = await prisma.userAccount.findUniqueOrThrow({ where: { id: creative.id } });
    expect(saved.workingHours).toBe("old note");
  });

  describe("telling admins", () => {
    it("notifies every active admin, with the new hours", async () => {
      const removed = await createUser({ role: "SITE_ADMIN" });
      await prisma.userAccount.update({
        where: { id: removed.id },
        data: { deletedAt: new Date() },
      });
      const customer = await createUser({ role: "CUSTOMER" });
      signIn(creative, "DESIGNER");

      await patchProfile(jsonReq({ workSchedule: schedule() }));

      const sent = await scheduleNotifications();
      expect(sent.map((n) => n.userId).sort()).toEqual([owner.id, admin.id].sort());
      expect(sent.map((n) => n.userId)).not.toContain(customer.id);
      expect(sent.map((n) => n.userId)).not.toContain(creative.id);
      expect(sent[0].message).toBe(
        "Ada Lane changed their working hours to Mon–Fri 09:00–18:00 (Europe/Istanbul).",
      );
      expect(sent[0].actorId).toBe(creative.id);
    });

    it("stays quiet when saving the same hours again, and keeps the date", async () => {
      signIn(creative, "DESIGNER");
      await patchProfile(jsonReq({ workSchedule: schedule() }));
      const first = await prisma.userAccount.findUniqueOrThrow({ where: { id: creative.id } });
      await prisma.notification.deleteMany();

      await patchProfile(jsonReq({ workSchedule: schedule() }));

      expect(await scheduleNotifications()).toEqual([]);
      const second = await prisma.userAccount.findUniqueOrThrow({ where: { id: creative.id } });
      expect(second.workScheduleUpdatedAt).toEqual(first.workScheduleUpdatedAt);
    });

    it("notifies again when the time zone alone changes", async () => {
      signIn(creative, "DESIGNER");
      await patchProfile(jsonReq({ workSchedule: schedule() }));
      await prisma.notification.deleteMany();

      await patchProfile(jsonReq({ workSchedule: { ...schedule(), timezone: "Asia/Dubai" } }));

      expect(await scheduleNotifications()).toHaveLength(2);
    });

    it("respects an admin who turned this notification off", async () => {
      await prisma.notificationPreference.create({
        data: {
          userId: admin.id,
          type: "CREATIVE_SCHEDULE_UPDATED",
          enabled: false,
          emailEnabled: false,
        },
      });
      signIn(creative, "DESIGNER");
      await patchProfile(jsonReq({ workSchedule: schedule() }));
      const sent = await scheduleNotifications();
      expect(sent.map((n) => n.userId)).toEqual([owner.id]);
    });
  });
});

describe("PATCH /api/admin/users", () => {
  it("lets an admin set a creative's hours, without notifying admins", async () => {
    signIn(admin, "SITE_ADMIN");
    const res = await patchAdminUser(jsonReq({ userId: creative.id, workSchedule: schedule() }));
    expect(res.status).toBe(200);
    expect((await res.json()).user.workSchedule).toEqual(schedule());
    expect(await scheduleNotifications()).toEqual([]);
  });

  it("rejects an invalid schedule and non-creatives", async () => {
    signIn(admin, "SITE_ADMIN");
    const bad = await patchAdminUser(jsonReq({ userId: creative.id, workSchedule: "9-18" }));
    expect(bad.status).toBe(400);
    const customer = await createUser({ role: "CUSTOMER" });
    const wrong = await patchAdminUser(jsonReq({ userId: customer.id, workSchedule: schedule() }));
    expect(wrong.status).toBe(400);
  });
});

describe("hire and onboarding", () => {
  async function seedHired(data: { workSchedule?: WorkSchedule; workingHours?: string }) {
    return prisma.talentApplication.create({
      data: {
        fullName: "New Hire",
        whatsappNumber: "+90500",
        email: "hire@test.local",
        country: "Turkey",
        timezone: "Europe/Istanbul",
        portfolioUrl: "https://example.test",
        totalYears: "2-5",
        hasRemoteExp: true,
        workload: "FULL_TIME",
        turnaroundOk: true,
        testTaskOk: true,
        communicationConfirmed: true,
        status: "HIRED",
        approvedCategoryIds: [],
        approvedTasksPerWeekCap: 5,
        ...data,
      } as never,
    });
  }

  it("requires a real schedule to hire", () => {
    const base = {
      action: "HIRE",
      approvedCategoryIds: ["cjld2cjxh0000qzrmn831i7rn"],
    };
    expect(
      talentApplicationActionSchema.safeParse({ ...base, workSchedule: schedule() }).success,
    ).toBe(true);
    expect(talentApplicationActionSchema.safeParse({ ...base, workingHours: "9-18" }).success).toBe(
      false,
    );
  });

  it("copies the agreed hours to the new creative's account", async () => {
    const application = await seedHired({ workSchedule: schedule() });
    const result = await onboardHiredTalent(application.id);
    expect(result.ok).toBe(true);
    const account = await prisma.userAccount.findUniqueOrThrow({
      where: { email: "hire@test.local" },
    });
    expect(account.workSchedule).toEqual(schedule());
    expect(account.workScheduleUpdatedAt).not.toBeNull();
  });

  it("carries an older hire's note across, leaving the schedule to be set", async () => {
    const application = await seedHired({ workingHours: "9-18 weekdays" });
    const result = await onboardHiredTalent(application.id);
    expect(result.ok).toBe(true);
    const account = await prisma.userAccount.findUniqueOrThrow({
      where: { email: "hire@test.local" },
    });
    expect(account.workingHours).toBe("9-18 weekdays");
    expect(account.workSchedule).toBeNull();
  });
});
