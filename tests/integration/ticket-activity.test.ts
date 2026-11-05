// -----------------------------------------------------------------------------
// @file: tests/integration/ticket-activity.test.ts
// @purpose: The Activity timeline against a real Postgres: every way a ticket
//           changes leaves a record, each role reads it in its own words, and
//           nobody learns what their role isn't meant to.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  getCurrentUserOrThrow: () => mockGetUser(),
}));
vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { GET as customerActivity } from "@/app/api/customer/tickets/[ticketId]/activity/route";
import { GET as creativeActivity } from "@/app/api/creative/tickets/[ticketId]/activity/route";
import { GET as adminActivity } from "@/app/api/admin/tickets/[ticketId]/activity/route";
import { PATCH as patchCustomerTicket } from "@/app/api/customer/tickets/[ticketId]/route";
import { POST as cancelTicket } from "@/app/api/customer/tickets/[ticketId]/cancel/route";
import { PATCH as patchStatus } from "@/app/api/customer/tickets/status/route";
import { POST as bulkTickets } from "@/app/api/admin/tickets/bulk/route";
import { PATCH as patchAdminTicket } from "@/app/api/admin/tickets/route";
import { POST as completeTicket } from "@/app/api/tickets/[id]/complete/route";
import { ACTIVITY_TRACKING_SINCE } from "@/lib/tickets/ticket-activity";
import { transitionCreativeTicketStatus } from "@/lib/tickets/transition-status";
import { resetDatabase } from "./helpers/db";
import {
  addCompanyMember,
  createCompany,
  createJobType,
  createTicket,
  createUser,
} from "./helpers/fixtures";

const ctx = (ticketId: string) => ({ params: Promise.resolve({ ticketId }) });

function jsonReq(body: unknown, method = "PATCH") {
  return new NextRequest("http://localhost/test", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const getReq = () => new NextRequest("http://localhost/test");

type Timeline = {
  activity: { id: string; at: string; actor: string; summary: string }[];
  partialHistory: boolean;
};

let company: { id: string };
let customer: { id: string };
let creative: { id: string };
let admin: { id: string };
let asCustomer: () => void;
let asCreative: () => void;
let asAdmin: () => void;

async function seedTicket(
  overrides: { status?: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE"; assigned?: boolean } = {},
) {
  const jobType = await createJobType({ tokenCost: 10 });
  return createTicket({
    companyId: company.id,
    createdById: customer.id,
    creativeId: overrides.assigned === false ? null : creative.id,
    jobTypeId: jobType.id,
    status: overrides.status ?? "TODO",
  });
}

async function timeline(
  handler: typeof customerActivity,
  ticketId: string,
  as: () => void,
): Promise<Timeline> {
  as();
  const res = await handler(getReq(), ctx(ticketId));
  expect(res.status).toBe(200);
  return res.json();
}

const lines = (t: Timeline) => t.activity.map((i) => `${i.actor} ${i.summary}`);
const eventsOf = (ticketId: string) =>
  prisma.ticketEvent.findMany({ where: { ticketId }, orderBy: { createdAt: "asc" } });

beforeEach(async () => {
  await resetDatabase();
  mockGetUser.mockReset();
  const c = await createCompany({ tokenBalance: 500 });
  company = c;
  const owner = await prisma.userAccount.create({
    data: {
      authUserId: "auth-owner",
      email: "ana@acme.test",
      name: "Ana Owner",
      role: "CUSTOMER",
    },
  });
  customer = owner;
  await addCompanyMember(c.id, owner.id, "OWNER");
  creative = await prisma.userAccount.create({
    data: { authUserId: "auth-ada", email: "ada@b.test", name: "Ada Creative", role: "DESIGNER" },
  });
  admin = await prisma.userAccount.create({
    data: { authUserId: "auth-sam", email: "sam@b.test", name: "Sam Admin", role: "SITE_ADMIN" },
  });
  asCustomer = () =>
    mockGetUser.mockResolvedValue({
      id: owner.id,
      email: "ana@acme.test",
      role: "CUSTOMER",
      activeCompanyId: c.id,
      companyRole: "OWNER",
    });
  asCreative = () =>
    mockGetUser.mockResolvedValue({
      id: creative.id,
      email: "ada@b.test",
      role: "DESIGNER",
      activeCompanyId: null,
    });
  asAdmin = () =>
    mockGetUser.mockResolvedValue({
      id: admin.id,
      email: "sam@b.test",
      role: "SITE_ADMIN",
      activeCompanyId: null,
    });
});

describe("history from existing tables", () => {
  async function seedHistory() {
    const ticket = await seedTicket({ status: "DONE" });
    await prisma.ticketAssignmentLog.create({
      data: { ticketId: ticket.id, creativeId: creative.id, reason: "AUTO_ASSIGN" },
    });
    await prisma.ticketRevision.create({
      data: {
        ticketId: ticket.id,
        version: 1,
        submittedByCreativeId: creative.id,
        submittedAt: new Date(Date.now() + 1000),
        creativeMessage: "PRIVATE creative note",
        feedbackByCustomerId: customer.id,
        feedbackAt: new Date(Date.now() + 2000),
        feedbackMessage: "PRIVATE feedback text",
      },
    });
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { completedAt: new Date(Date.now() + 3000), completedById: customer.id },
    });
    return ticket;
  }

  it("rebuilds the timeline, newest first, in the customer's words", async () => {
    const ticket = await seedHistory();
    const t = await timeline(customerActivity, ticket.id, asCustomer);
    expect(lines(t)).toEqual([
      "You marked this request as Done",
      "You requested changes on version 1",
      "Your creative submitted version 1",
      "brandbite assigned a creative",
      "You created this request",
    ]);
  });

  it("speaks to the creative as you, and names the customer", async () => {
    const ticket = await seedHistory();
    const t = await timeline(creativeActivity, ticket.id, asCreative);
    expect(lines(t)).toEqual([
      "Ana Owner marked this job as Done",
      "Ana Owner requested changes on version 1",
      "You submitted version 1",
      "brandbite assigned you",
      "Ana Owner created this job",
    ]);
  });

  it("gives admins real names", async () => {
    const ticket = await seedHistory();
    const t = await timeline(adminActivity, ticket.id, asAdmin);
    expect(lines(t)).toContain("Ada Creative submitted version 1");
    expect(lines(t)).toContain("brandbite assigned Ada Creative");
  });

  it("keeps message text out of every role's timeline", async () => {
    const ticket = await seedHistory();
    for (const [handler, as] of [
      [customerActivity, asCustomer],
      [creativeActivity, asCreative],
      [adminActivity, asAdmin],
    ] as const) {
      const t = await timeline(handler, ticket.id, as);
      expect(JSON.stringify(t)).not.toContain("PRIVATE");
    }
  });

  it("never gives a customer the creative's name or anyone's email", async () => {
    const ticket = await seedHistory();
    await prisma.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        actorId: admin.id,
        type: "CREATIVE_CHANGED",
        metadata: { toCreativeId: creative.id },
      },
    });
    const json = JSON.stringify(await timeline(customerActivity, ticket.id, asCustomer));
    expect(json).not.toContain("Ada");
    expect(json).not.toContain("Sam");
    expect(json).not.toContain("@");
    expect(json).toContain("The brandbite team");
  });

  it("flags older tickets as partial, and new ones as complete", async () => {
    const ticket = await seedTicket();
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { createdAt: ACTIVITY_TRACKING_SINCE },
    });
    expect((await timeline(customerActivity, ticket.id, asCustomer)).partialHistory).toBe(false);
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { createdAt: new Date("2026-01-01T00:00:00Z") },
    });
    expect((await timeline(customerActivity, ticket.id, asCustomer)).partialHistory).toBe(true);
  });
});

describe("every change leaves a record", () => {
  it("requesting changes appears once, as feedback on the version", async () => {
    const ticket = await seedTicket({ status: "IN_REVIEW" });
    await prisma.ticketRevision.create({
      data: { ticketId: ticket.id, version: 1, submittedByCreativeId: creative.id },
    });
    asCustomer();
    const res = await patchStatus(
      jsonReq({
        ticketId: ticket.id,
        status: "IN_PROGRESS",
        revisionMessage: "PRIVATE change request",
      }) as never,
    );
    expect(res.status).toBe(200);
    expect(await eventsOf(ticket.id)).toEqual([]);
    const t = await timeline(customerActivity, ticket.id, asCustomer);
    expect(lines(t)[0]).toBe("You requested changes on version 1");
    expect(JSON.stringify(t)).not.toContain("PRIVATE");
  });

  it("marking done through the board doesn't appear twice", async () => {
    const ticket = await seedTicket({ status: "IN_REVIEW" });
    asCustomer();
    const res = await patchStatus(jsonReq({ ticketId: ticket.id, status: "DONE" }) as never);
    expect(res.status).toBe(200);
    const t = await timeline(customerActivity, ticket.id, asCustomer);
    expect(lines(t).filter((l) => /Done/.test(l))).toEqual(["You marked this request as Done"]);
  });

  it("customer drag on the detail status path", async () => {
    const ticket = await seedTicket({ status: "IN_PROGRESS" });
    asCustomer();
    const res = await patchCustomerTicket(jsonReq({ status: "IN_REVIEW" }), ctx(ticket.id));
    expect(res.status).toBe(200);
    const [event] = await eventsOf(ticket.id);
    expect(event.metadata).toEqual({ from: "IN_PROGRESS", to: "IN_REVIEW" });
    expect(event.actorId).toBe(customer.id);
  });

  it("cancelling, in the same transaction as the refund", async () => {
    const ticket = await seedTicket({ assigned: false });
    asCustomer();
    const res = await cancelTicket(new NextRequest("http://localhost/test"), ctx(ticket.id));
    expect(res.status).toBe(200);
    const t = await timeline(customerActivity, ticket.id, asCustomer);
    expect(lines(t)[0]).toBe("You cancelled this request");
  });

  it("creative moving a job, but not when the new version already says so", async () => {
    const ticket = await seedTicket({ status: "IN_PROGRESS" });
    const toReview = await transitionCreativeTicketStatus({
      creativeUserId: creative.id,
      ticketId: ticket.id,
      nextStatus: "IN_REVIEW",
    });
    expect(toReview.success).toBe(true);
    expect(await eventsOf(ticket.id)).toEqual([]);

    const other = await seedTicket({ status: "TODO" });
    const started = await transitionCreativeTicketStatus({
      creativeUserId: creative.id,
      ticketId: other.id,
      nextStatus: "IN_PROGRESS",
    });
    expect(started.success).toBe(true);
    const t = await timeline(customerActivity, other.id, asCustomer);
    expect(lines(t)[0]).toBe("Your creative moved this request from Backlog to In progress");
  });

  it("admin bulk status, priority and reassign", async () => {
    const ticket = await seedTicket();
    const other = await createUser({ role: "DESIGNER" });
    asAdmin();

    for (const body of [
      { op: "status", ticketIds: [ticket.id], status: "IN_PROGRESS" },
      { op: "priority", ticketIds: [ticket.id], priority: "URGENT" },
      { op: "reassign", ticketIds: [ticket.id], creativeId: other.id },
    ]) {
      const res = await bulkTickets(jsonReq(body, "POST"));
      expect(res.status).toBe(200);
    }

    const t = await timeline(customerActivity, ticket.id, asCustomer);
    expect(lines(t)).toEqual(
      expect.arrayContaining([
        "The brandbite team moved this request from Backlog to In progress",
        "The brandbite team updated the priority (Medium to Urgent)",
        "The brandbite team assigned a creative",
      ]),
    );
  });

  it("admin reassigning one ticket, only when the creative changes", async () => {
    const ticket = await seedTicket();
    asAdmin();
    await patchAdminTicket(jsonReq({ ticketId: ticket.id, creativeId: creative.id }));
    expect(await eventsOf(ticket.id)).toEqual([]);

    await patchAdminTicket(jsonReq({ ticketId: ticket.id, creativeId: null }));
    const t = await timeline(adminActivity, ticket.id, asAdmin);
    expect(lines(t)[0]).toBe("You removed the assigned creative");
  });

  it("admin completing through the payout route", async () => {
    const ticket = await seedTicket({ status: "IN_REVIEW" });
    asAdmin();
    const res = await completeTicket(new NextRequest("http://localhost/test", { method: "POST" }), {
      params: Promise.resolve({ id: ticket.id }),
    });
    expect(res.status).toBe(200);
    const t = await timeline(customerActivity, ticket.id, asCustomer);
    expect(lines(t)[0]).toBe("The brandbite team moved this request from In review to Done");
  });

  describe("customer edits", () => {
    it("records only the fields that really changed", async () => {
      const ticket = await seedTicket({ assigned: false });
      asCustomer();
      const res = await patchCustomerTicket(
        jsonReq({ title: ticket.title, priority: "HIGH", dueDate: "2026-12-01" }),
        ctx(ticket.id),
      );
      expect(res.status).toBe(200);
      const t = await timeline(customerActivity, ticket.id, asCustomer);
      expect(lines(t)[0]).toBe("You updated the priority (Medium to High) and due date");
    });

    it("leaves the due date alone when the request doesn't mention it", async () => {
      const ticket = await seedTicket({ assigned: false });
      const dueDate = new Date("2026-12-01T00:00:00Z");
      await prisma.ticket.update({ where: { id: ticket.id }, data: { dueDate } });
      asCustomer();
      const res = await patchCustomerTicket(jsonReq({ priority: "HIGH" }), ctx(ticket.id));
      expect(res.status).toBe(200);

      const saved = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      expect(saved.dueDate).toEqual(dueDate);
      const t = await timeline(customerActivity, ticket.id, asCustomer);
      expect(lines(t)[0]).toBe("You updated the priority (Medium to High)");
    });

    it("still clears the due date when asked to", async () => {
      const ticket = await seedTicket({ assigned: false });
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { dueDate: new Date("2026-12-01T00:00:00Z") },
      });
      asCustomer();
      const res = await patchCustomerTicket(jsonReq({ dueDate: null }), ctx(ticket.id));
      expect(res.status).toBe(200);
      const saved = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
      expect(saved.dueDate).toBeNull();
    });

    it("records nothing when a form saves without changes", async () => {
      const ticket = await seedTicket({ assigned: false });
      asCustomer();
      const res = await patchCustomerTicket(
        jsonReq({ title: ticket.title, priority: "MEDIUM" }),
        ctx(ticket.id),
      );
      expect(res.status).toBe(200);
      expect(await eventsOf(ticket.id)).toEqual([]);
    });
  });
});

describe("access", () => {
  it("hides a ticket from another company's customer", async () => {
    const ticket = await seedTicket();
    const other = await createCompany();
    mockGetUser.mockResolvedValue({
      id: customer.id,
      role: "CUSTOMER",
      activeCompanyId: other.id,
    });
    expect((await customerActivity(getReq(), ctx(ticket.id))).status).toBe(404);
  });

  it("hides a ticket from a creative who isn't assigned", async () => {
    const ticket = await seedTicket({ assigned: false });
    asCreative();
    expect((await creativeActivity(getReq(), ctx(ticket.id))).status).toBe(404);
  });

  it("keeps each route to its own role", async () => {
    const ticket = await seedTicket();
    asCreative();
    expect((await customerActivity(getReq(), ctx(ticket.id))).status).toBe(403);
    expect((await adminActivity(getReq(), ctx(ticket.id))).status).toBe(403);
    asCustomer();
    expect((await creativeActivity(getReq(), ctx(ticket.id))).status).toBe(403);
    expect((await adminActivity(getReq(), ctx(ticket.id))).status).toBe(403);
  });

  it("is 401 without a session", async () => {
    const ticket = await seedTicket();
    const err: Error & { code?: string } = new Error("UNAUTHENTICATED");
    err.code = "UNAUTHENTICATED";
    mockGetUser.mockRejectedValue(err);
    for (const handler of [customerActivity, creativeActivity, adminActivity]) {
      expect((await handler(getReq(), ctx(ticket.id))).status).toBe(401);
    }
  });
});
