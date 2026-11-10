// -----------------------------------------------------------------------------
// @file: tests/integration/source-file-retention.test.ts
// @purpose: The 90-day rule against a real Postgres: Done sets the deletion
//           date on R2 files only, reminders go out 14 and 3 days before to
//           owners, PMs and the requester (once each), files are deleted on
//           the date, unfinished uploads are cleaned up, and the daily cron
//           needs the secret.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { deleted } = vi.hoisted(() => ({ deleted: [] as string[] }));

vi.mock("@/lib/email", () => ({ sendNotificationEmail: vi.fn(async () => undefined) }));
vi.mock("@/lib/r2", async (orig) => ({
  ...(await orig<typeof import("@/lib/r2")>()),
  deleteR2Objects: async (keys: (string | null)[]) => {
    deleted.push(...keys.filter((k): k is string => !!k));
  },
}));

import { prisma } from "@/lib/prisma";
import { GET as dailyMaintenance } from "@/app/api/cron/daily-maintenance/route";
import { runSourceFileRetention, scheduleSourceFileRetention } from "@/lib/source-files/retention";
import { completeTicketAndApplyTokens } from "@/lib/token-engine";
import { resetDatabase } from "./helpers/db";
import {
  addCompanyMember,
  createCompany,
  createJobType,
  createTicket,
  createUser,
} from "./helpers/fixtures";

const DAY = 24 * 60 * 60 * 1000;
let ticketId: string;
let requesterId: string;
let ownerId: string;
let pmId: string;
let billingId: string;

async function file(
  overrides: Partial<{
    storage: "R2" | "GOOGLE_DRIVE";
    status: "READY" | "UPLOADING";
    deleteAfter: Date | null;
    createdAt: Date;
    r2Key: string;
  }> = {},
) {
  return prisma.ticketSourceFile.create({
    data: {
      ticketId,
      name: "poster.psd",
      sizeBytes: BigInt(10),
      storage: overrides.storage ?? "R2",
      status: overrides.status ?? "READY",
      r2Key: overrides.r2Key ?? `tickets/${ticketId}/source/${Math.random()}`,
      deleteAfter: overrides.deleteAfter ?? null,
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
    },
  });
}

const reminders = () =>
  prisma.notification.findMany({
    where: { type: "SOURCE_FILES_EXPIRING" },
    orderBy: { userId: "asc" },
  });

beforeEach(async () => {
  await resetDatabase();
  deleted.length = 0;
  const company = await createCompany();
  const [requester, owner, pm, billing] = await Promise.all([
    createUser(),
    createUser(),
    createUser(),
    createUser(),
  ]);
  await addCompanyMember(company.id, requester.id, "MEMBER");
  await addCompanyMember(company.id, owner.id, "OWNER");
  await addCompanyMember(company.id, pm.id, "PM");
  await addCompanyMember(company.id, billing.id, "BILLING");
  const ticket = await createTicket({
    companyId: company.id,
    createdById: requester.id,
    status: "DONE",
  });
  ticketId = ticket.id;
  requesterId = requester.id;
  ownerId = owner.id;
  pmId = pm.id;
  billingId = billing.id;
});

describe("source file retention", () => {
  it("starts the 90-day clock on R2 files only when the request is done", async () => {
    const r2 = await file();
    const drive = await file({ storage: "GOOGLE_DRIVE" });
    const completedAt = new Date("2026-11-01T10:00:00Z");
    expect(await scheduleSourceFileRetention(ticketId, completedAt)).toBe(1);
    const after = await prisma.ticketSourceFile.findMany({ orderBy: { createdAt: "asc" } });
    expect(after.find((f) => f.id === r2.id)?.deleteAfter?.toISOString()).toBe(
      "2027-01-30T10:00:00.000Z",
    );
    expect(after.find((f) => f.id === drive.id)?.deleteAfter).toBeNull();
  });

  it("sets the date when a request is completed through the payout engine", async () => {
    const company = await createCompany({ tokenBalance: 500 });
    const creative = await createUser({ role: "DESIGNER" });
    const jobType = await createJobType();
    const t = await createTicket({
      companyId: company.id,
      createdById: requesterId,
      creativeId: creative.id,
      jobTypeId: jobType.id,
      status: "IN_REVIEW",
    });
    const f = await prisma.ticketSourceFile.create({
      data: {
        ticketId: t.id,
        name: "a.psd",
        sizeBytes: BigInt(1),
        storage: "R2",
        status: "READY",
        r2Key: "k",
      },
    });
    await completeTicketAndApplyTokens(t.id);
    const saved = await prisma.ticketSourceFile.findUniqueOrThrow({ where: { id: f.id } });
    expect(saved.deleteAfter).not.toBeNull();
    const days = (saved.deleteAfter!.getTime() - Date.now()) / DAY;
    expect(days).toBeGreaterThan(89);
    expect(days).toBeLessThanOrEqual(90);
  });

  it("reminds owners, PMs and the requester 14 days before, once", async () => {
    const now = new Date("2026-12-01T06:00:00Z");
    await file({ deleteAfter: new Date(now.getTime() + 10 * DAY) });

    const first = await runSourceFileRetention(now);
    expect(first.remindersSent).toBe(3);
    const sent = await reminders();
    expect(sent.map((n) => n.userId).sort()).toEqual([requesterId, ownerId, pmId].sort());
    expect(sent.map((n) => n.userId)).not.toContain(billingId);
    expect(sent[0].title).toBe("Source files deleted in 14 days");
    expect(sent[0].message).toContain("Dec 11, 2026");

    expect((await runSourceFileRetention(new Date(now.getTime() + DAY))).remindersSent).toBe(0);
  });

  it("sends the 3-day reminder later, and only that one when a file is already close", async () => {
    const now = new Date("2026-12-01T06:00:00Z");
    await file({ deleteAfter: new Date(now.getTime() + 10 * DAY) });
    await runSourceFileRetention(now);
    await runSourceFileRetention(new Date(now.getTime() + 8 * DAY));
    const titles = (await reminders()).map((n) => n.title);
    expect(titles.filter((t) => t.includes("3 days"))).toHaveLength(3);

    await prisma.notification.deleteMany({});
    await prisma.ticketSourceFile.deleteMany({});
    await file({ deleteAfter: new Date(now.getTime() + 2 * DAY) });
    await runSourceFileRetention(now);
    const late = (await reminders()).map((n) => n.title);
    expect(late).toHaveLength(3);
    expect(late.every((t) => t.includes("3 days"))).toBe(true);
    await runSourceFileRetention(new Date(now.getTime() + DAY));
    expect(await reminders()).toHaveLength(3);
  });

  it("deletes files from R2 on their date and leaves Drive files alone", async () => {
    const now = new Date("2026-12-01T06:00:00Z");
    const due = await file({ deleteAfter: new Date(now.getTime() - 1000), r2Key: "k-due" });
    const later = await file({ deleteAfter: new Date(now.getTime() + 30 * DAY), r2Key: "k-later" });
    await file({ storage: "GOOGLE_DRIVE", deleteAfter: new Date(now.getTime() - 1000) });

    const result = await runSourceFileRetention(now);
    expect(result.filesDeleted).toBe(1);
    expect(deleted).toEqual(["k-due"]);
    expect(
      (await prisma.ticketSourceFile.findUniqueOrThrow({ where: { id: due.id } })).deletedAt,
    ).not.toBeNull();
    expect(
      (await prisma.ticketSourceFile.findUniqueOrThrow({ where: { id: later.id } })).deletedAt,
    ).toBeNull();
  });

  it("cleans up uploads that never finished after a day", async () => {
    const now = new Date("2026-12-01T06:00:00Z");
    const stale = await file({
      status: "UPLOADING",
      createdAt: new Date(now.getTime() - 2 * DAY),
      r2Key: "k-stale",
    });
    const fresh = await file({ status: "UPLOADING", createdAt: new Date(now.getTime() - 60_000) });
    const result = await runSourceFileRetention(now);
    expect(result.staleUploadsCleared).toBe(1);
    expect(deleted).toContain("k-stale");
    expect(
      (await prisma.ticketSourceFile.findUniqueOrThrow({ where: { id: stale.id } })).status,
    ).toBe("FAILED");
    expect(
      (await prisma.ticketSourceFile.findUniqueOrThrow({ where: { id: fresh.id } })).status,
    ).toBe("UPLOADING");
  });

  it("runs from the daily cron only with the secret", async () => {
    process.env.CRON_SECRET = "s3cret";
    const unauthorized = await dailyMaintenance(
      new NextRequest("http://localhost/api/cron/daily-maintenance"),
    );
    expect(unauthorized.status).toBe(401);
    const res = await dailyMaintenance(
      new NextRequest("http://localhost/api/cron/daily-maintenance", {
        headers: { authorization: "Bearer s3cret" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sourceFiles).toMatchObject({ filesDeleted: 0 });
    expect(body.googleCalendar).toBeDefined();
  });
});
