// -----------------------------------------------------------------------------
// @file: tests/integration/auto-timer.test.ts
// @purpose: The creative's timer follows the request status: Start work (and
//           pulling a version back) starts it, leaving In progress stops it,
//           starting several requests at once starts none, and a customer
//           asking for changes never starts it.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }));

vi.mock("@/lib/auth", () => ({ getCurrentUserOrThrow: () => mockGetUser() }));
vi.mock("@/lib/email", () => ({ sendNotificationEmail: vi.fn(async () => undefined) }));

import { prisma } from "@/lib/prisma";
import { PATCH as creativePatch } from "@/app/api/creative/tickets/route";
import { PATCH as creativeBatch } from "@/app/api/creative/tickets/batch/route";
import { POST as adminBulk } from "@/app/api/admin/tickets/bulk/route";
import { syncTimerWithStatus } from "@/lib/tickets/auto-timer";
import { resetDatabase } from "./helpers/db";
import { addCompanyMember, createCompany, createTicket, createUser } from "./helpers/fixtures";

let creativeId: string;
let customerId: string;

const running = () => prisma.ticketTimeEntry.findMany({ where: { creativeId, endedAt: null } });
const req = (url: string, method: string, body: unknown) =>
  new NextRequest(`http://localhost${url}`, { method, body: JSON.stringify(body) });

beforeEach(async () => {
  await resetDatabase();
  const creative = await createUser({ role: "DESIGNER" });
  const customer = await createUser();
  creativeId = creative.id;
  customerId = customer.id;
  mockGetUser.mockResolvedValue({ id: creativeId, role: "DESIGNER", email: creative.email });
});

// Each request in its own company, so the per-company "active requests in
// progress" limit doesn't get in the way of starting several.
const ticket = async (status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" = "TODO") => {
  const company = await createCompany();
  await addCompanyMember(company.id, customerId, "OWNER");
  return createTicket({ companyId: company.id, createdById: customerId, creativeId, status });
};

describe("auto timer", () => {
  it("starts the creative's timer when they press Start work", async () => {
    const t = await ticket();
    const res = await creativePatch(
      req("/api/creative/tickets", "PATCH", { id: t.id, status: "IN_PROGRESS" }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).timer).toEqual({ started: true, stoppedOtherTicketId: null });
    const [entry] = await running();
    expect(entry.ticketId).toBe(t.id);
  });

  it("moves the timer from another request and says so", async () => {
    const first = await ticket();
    const second = await ticket();
    await creativePatch(req("/x", "PATCH", { id: first.id, status: "IN_PROGRESS" }));
    const res = await creativePatch(req("/x", "PATCH", { id: second.id, status: "IN_PROGRESS" }));
    expect((await res.json()).timer).toEqual({ started: true, stoppedOtherTicketId: first.id });
    const entries = await running();
    expect(entries.map((e) => e.ticketId)).toEqual([second.id]);
  });

  it("starts nothing when several requests are started at once, one when it's a single one", async () => {
    const a = await ticket();
    const b = await ticket();
    const both = await creativeBatch(
      req("/x", "PATCH", { ticketIds: [a.id, b.id], status: "IN_PROGRESS" }),
    );
    expect((await both.json()).timer.started).toBe(false);
    expect(await running()).toHaveLength(0);

    const c = await ticket();
    const one = await creativeBatch(
      req("/x", "PATCH", { ticketIds: [c.id], status: "IN_PROGRESS" }),
    );
    expect((await one.json()).timer.started).toBe(true);
    expect((await running()).map((e) => e.ticketId)).toEqual([c.id]);
  });

  it("stops the timer when an admin moves the request out of In progress", async () => {
    const t = await ticket();
    await creativePatch(req("/x", "PATCH", { id: t.id, status: "IN_PROGRESS" }));
    expect(await running()).toHaveLength(1);

    mockGetUser.mockResolvedValue({ id: "admin", role: "SITE_ADMIN", email: "admin@test" });
    const res = await adminBulk(
      req("/api/admin/tickets/bulk", "POST", {
        op: "status",
        ticketIds: [t.id],
        status: "IN_REVIEW",
      }),
    );
    expect(res.status).toBe(200);
    expect(await running()).toHaveLength(0);
    const [stopped] = await prisma.ticketTimeEntry.findMany({ where: { ticketId: t.id } });
    expect(stopped.endedAt).not.toBeNull();
  });

  it("never starts the timer when the customer asks for changes", async () => {
    const t = await ticket("IN_REVIEW");
    const result = await syncTimerWithStatus({
      ticketId: t.id,
      previousStatus: "IN_REVIEW",
      nextStatus: "IN_PROGRESS",
      creativeId,
      startForCreative: false,
    });
    expect(result.started).toBe(false);
    expect(await running()).toHaveLength(0);
  });
});
