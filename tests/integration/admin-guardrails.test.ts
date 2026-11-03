// -----------------------------------------------------------------------------
// @file: tests/integration/admin-guardrails.test.ts
// @purpose: Admin guardrails added in Nov 2026:
//             - plan assignment is refused for companies with a live Stripe
//               subscription (it doesn't change Stripe billing);
//             - bulk status changes skip no-ops, refuse moving Done tickets
//               back (the creative was already paid) and write one audit row.
// -----------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  getCurrentUserOrThrow: () => mockGetUser(),
}));
vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { PATCH as assignPlan } from "@/app/api/admin/plan-assignment/route";
import { POST as bulkTickets } from "@/app/api/admin/tickets/bulk/route";
import { resetDatabase } from "./helpers/db";
import { createCompany, createPlan, createTicket, createUser } from "./helpers/fixtures";

function jsonReq(method: string, body: unknown) {
  return new NextRequest("http://localhost/test", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function actAsOwner() {
  const owner = await createUser({ role: "SITE_OWNER" });
  mockGetUser.mockResolvedValue({ id: owner.id, email: "o@test.local", role: "SITE_OWNER" });
  return owner;
}

beforeEach(async () => {
  await resetDatabase();
  mockGetUser.mockReset();
});

describe("PATCH /api/admin/plan-assignment", () => {
  it("refuses a company with a live Stripe subscription (409, plan unchanged)", async () => {
    await actAsOwner();
    const current = await createPlan();
    const next = await createPlan();
    const company = await createCompany({ planId: current.id });
    await prisma.company.update({
      where: { id: company.id },
      data: { stripeSubscriptionId: "sub_test_live", billingStatus: "ACTIVE" },
    });

    const res = await assignPlan(jsonReq("PATCH", { companyId: company.id, planId: next.id }));
    expect(res.status).toBe(409);
    const after = await prisma.company.findUniqueOrThrow({ where: { id: company.id } });
    expect(after.planId).toBe(current.id);
  });

  it("still assigns a plan to a company without a subscription", async () => {
    await actAsOwner();
    const plan = await createPlan();
    const company = await createCompany();

    const res = await assignPlan(jsonReq("PATCH", { companyId: company.id, planId: plan.id }));
    expect(res.status).toBe(200);
    const after = await prisma.company.findUniqueOrThrow({ where: { id: company.id } });
    expect(after.planId).toBe(plan.id);
  });
});

describe("POST /api/admin/tickets/bulk — status", () => {
  it("refuses moving a Done ticket back and audits the real changes once", async () => {
    await actAsOwner();
    const company = await createCompany();
    const customer = await createUser();
    const done = await createTicket({
      companyId: company.id,
      createdById: customer.id,
      status: "DONE",
    });
    const todo = await createTicket({
      companyId: company.id,
      createdById: customer.id,
      status: "TODO",
    });

    const res = await bulkTickets(
      jsonReq("POST", { op: "status", status: "IN_PROGRESS", ticketIds: [done.id, todo.id] }),
    );
    const json = await res.json();
    expect(json.succeeded).toEqual([todo.id]);
    expect(json.failed[0].id).toBe(done.id);

    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: done.id } })).status).toBe("DONE");
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: todo.id } })).status).toBe(
      "IN_PROGRESS",
    );
    expect(
      await prisma.adminActionLog.count({ where: { action: "TICKET_BULK_STATUS_CHANGE" } }),
    ).toBe(1);
  });
});
