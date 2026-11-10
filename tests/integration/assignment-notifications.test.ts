// -----------------------------------------------------------------------------
// @file: tests/integration/assignment-notifications.test.ts
// @purpose: A creative gets a "New request assigned" notification whenever an
//           admin assigns them, on the request itself or in bulk, and not
//           when the request is unassigned or kept on the same creative.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }));

vi.mock("@/lib/auth", () => ({ getCurrentUserOrThrow: () => mockGetUser() }));
vi.mock("@/lib/email", () => ({ sendNotificationEmail: vi.fn(async () => undefined) }));

import { prisma } from "@/lib/prisma";
import { PATCH as patchTicket } from "@/app/api/admin/tickets/route";
import { POST as bulk } from "@/app/api/admin/tickets/bulk/route";
import { resetDatabase } from "./helpers/db";
import { createCompany, createTicket, createUser } from "./helpers/fixtures";

let adminId: string;
let creativeId: string;
let companyId: string;
let customerId: string;

const req = (url: string, method: string, body: unknown) =>
  new NextRequest(`http://localhost${url}`, { method, body: JSON.stringify(body) });

const notificationsFor = (userId: string) =>
  prisma.notification.findMany({ where: { userId, type: "TICKET_ASSIGNED" } });

beforeEach(async () => {
  await resetDatabase();
  const admin = await createUser({ role: "SITE_ADMIN" });
  const creative = await createUser({ role: "DESIGNER" });
  const customer = await createUser();
  const company = await createCompany();
  adminId = admin.id;
  creativeId = creative.id;
  companyId = company.id;
  customerId = customer.id;
  mockGetUser.mockResolvedValue({ id: adminId, role: "SITE_ADMIN", email: admin.email });
});

describe("assignment notifications", () => {
  it("notifies the creative an admin assigns on the request", async () => {
    const ticket = await createTicket({ companyId, createdById: customerId });
    const res = await patchTicket(
      req("/api/admin/tickets", "PATCH", { ticketId: ticket.id, creativeId }),
    );
    expect(res.status).toBe(200);

    const [notification] = await notificationsFor(creativeId);
    expect(notification).toMatchObject({
      title: "New request assigned",
      ticketId: ticket.id,
      actorId: adminId,
    });
    expect(notification.message).toContain(ticket.title);
  });

  it("doesn't notify when the creative stays the same or the request is unassigned", async () => {
    const ticket = await createTicket({ companyId, createdById: customerId, creativeId });
    await patchTicket(req("/api/admin/tickets", "PATCH", { ticketId: ticket.id, creativeId }));
    await patchTicket(
      req("/api/admin/tickets", "PATCH", { ticketId: ticket.id, creativeId: null }),
    );
    expect(await notificationsFor(creativeId)).toHaveLength(0);
  });

  it("notifies once per request on a bulk reassign", async () => {
    const a = await createTicket({ companyId, createdById: customerId });
    const b = await createTicket({ companyId, createdById: customerId });
    const res = await bulk(
      req("/api/admin/tickets/bulk", "POST", {
        op: "reassign",
        ticketIds: [a.id, b.id],
        creativeId,
      }),
    );
    expect(res.status).toBe(200);
    const notifications = await notificationsFor(creativeId);
    expect(notifications.map((n) => n.ticketId).sort()).toEqual([a.id, b.id].sort());
  });
});
