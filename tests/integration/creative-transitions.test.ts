// -----------------------------------------------------------------------------
// @file: tests/integration/creative-transitions.test.ts
// @purpose: The creative status routes (single PATCH and bulk) enforce the
//           shared move rule: no TODO → IN_REVIEW (a review with no
//           revision) and no IN_REVIEW → TODO (hiding delivered work).
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
import { PATCH as patchTicket } from "@/app/api/creative/tickets/route";
import { PATCH as patchBatch } from "@/app/api/creative/tickets/batch/route";
import { resetDatabase } from "./helpers/db";
import { createCompany, createJobType, createTicket, createUser } from "./helpers/fixtures";

function jsonReq(body: unknown) {
  return new NextRequest("http://localhost/test", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function seed(status: "TODO" | "IN_PROGRESS" | "IN_REVIEW") {
  const company = await createCompany();
  const customer = await createUser();
  const creative = await createUser({ role: "DESIGNER" });
  const jobType = await createJobType();
  const ticket = await createTicket({
    companyId: company.id,
    createdById: customer.id,
    creativeId: creative.id,
    jobTypeId: jobType.id,
    status,
  });
  mockGetUser.mockResolvedValue({ id: creative.id, email: "c@test.local", role: "DESIGNER" });
  return { ticket };
}

async function statusOf(id: string) {
  return (await prisma.ticket.findUniqueOrThrow({ where: { id } })).status;
}

beforeEach(async () => {
  await resetDatabase();
  mockGetUser.mockReset();
});

describe("PATCH /api/creative/tickets", () => {
  it("refuses TODO → IN_REVIEW with 409 and creates no revision", async () => {
    const { ticket } = await seed("TODO");
    const res = await patchTicket(jsonReq({ id: ticket.id, status: "IN_REVIEW" }));
    expect(res.status).toBe(409);
    expect(await statusOf(ticket.id)).toBe("TODO");
    expect(await prisma.ticketRevision.count({ where: { ticketId: ticket.id } })).toBe(0);
  });

  it("refuses IN_REVIEW → TODO with 409", async () => {
    const { ticket } = await seed("IN_REVIEW");
    const res = await patchTicket(jsonReq({ id: ticket.id, status: "TODO" }));
    expect(res.status).toBe(409);
    expect(await statusOf(ticket.id)).toBe("IN_REVIEW");
  });

  it("still allows IN_PROGRESS → IN_REVIEW and creates a revision", async () => {
    const { ticket } = await seed("IN_PROGRESS");
    const res = await patchTicket(jsonReq({ id: ticket.id, status: "IN_REVIEW" }));
    expect(res.status).toBe(200);
    expect(await statusOf(ticket.id)).toBe("IN_REVIEW");
    expect(await prisma.ticketRevision.count({ where: { ticketId: ticket.id } })).toBe(1);
  });
});

describe("PATCH /api/creative/tickets/batch", () => {
  it("skips IN_REVIEW tickets on Move to Backlog", async () => {
    const { ticket } = await seed("IN_REVIEW");
    const res = await patchBatch(jsonReq({ ticketIds: [ticket.id], status: "TODO" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.failCount).toBe(1);
    expect(json.results[0].error).toMatch(/Pull it back/);
    expect(await statusOf(ticket.id)).toBe("IN_REVIEW");
  });

  it("still moves IN_PROGRESS tickets back to TODO", async () => {
    const { ticket } = await seed("IN_PROGRESS");
    const res = await patchBatch(jsonReq({ ticketIds: [ticket.id], status: "TODO" }));
    expect((await res.json()).successCount).toBe(1);
    expect(await statusOf(ticket.id)).toBe("TODO");
  });
});
