// -----------------------------------------------------------------------------
// @file: tests/integration/route-authorization.test.ts
// @purpose: Regression coverage for the access-control fixes shipped in the
//           security audit (PR #268):
//             - POST /api/tickets/[id]/complete is no longer unauthenticated;
//               only site admins or the assigned creative may complete a ticket
//               (and mint the payout).
//             - PATCH /api/customer/members/[memberId] only lets an OWNER grant
//               the OWNER role — a PM can no longer self-escalate.
//
//           The session is mocked (getCurrentUserOrThrow) so we can drive each
//           role; everything else — Prisma, token-engine, permission helpers —
//           runs for real against the test Postgres.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  getCurrentUserOrThrow: () => mockGetUser(),
}));
// Notifications are fire-and-forget in the route; stub to keep tests
// deterministic (no floating DB writes racing resetDatabase).
vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getUserTokenBalance } from "@/lib/token-engine";
import { POST as completeTicket } from "@/app/api/tickets/[id]/complete/route";
import { PATCH as patchMember } from "@/app/api/customer/members/[memberId]/route";
import { resetDatabase } from "./helpers/db";
import {
  addCompanyMember,
  createCompany,
  createJobType,
  createTicket,
  createUser,
} from "./helpers/fixtures";

function unauthenticated() {
  const err: Error & { code?: string } = new Error("UNAUTHENTICATED");
  err.code = "UNAUTHENTICATED";
  return err;
}

function completeCtx(ticketId: string) {
  return { params: Promise.resolve({ id: ticketId }) };
}
function memberCtx(memberId: string) {
  return { params: Promise.resolve({ memberId }) };
}
const dummyReq = () => new Request("http://localhost/test", { method: "POST" });

beforeEach(async () => {
  await resetDatabase();
  mockGetUser.mockReset();
});

describe("POST /api/tickets/[id]/complete — authorization", () => {
  async function seedAssignedTicket() {
    const company = await createCompany({ tokenBalance: 1000 });
    const customer = await createUser({ role: "CUSTOMER" });
    const creative = await createUser({ role: "DESIGNER" });
    const jobType = await createJobType({ tokenCost: 30, creativePayoutTokens: 10 });
    const ticket = await createTicket({
      companyId: company.id,
      createdById: customer.id,
      creativeId: creative.id,
      jobTypeId: jobType.id,
      quantity: 2,
      status: "IN_REVIEW",
    });
    return { company, customer, creative, ticket };
  }

  it("rejects an unauthenticated caller with 401 (was previously unauthenticated)", async () => {
    const { ticket } = await seedAssignedTicket();
    mockGetUser.mockRejectedValue(unauthenticated());

    const res = await completeTicket(dummyReq(), completeCtx(ticket.id));
    expect(res.status).toBe(401);

    // No payout was minted.
    const t = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(t.status).toBe("IN_REVIEW");
    expect(await prisma.tokenLedger.count({ where: { ticketId: ticket.id } })).toBe(0);
  });

  it("rejects a logged-in customer who is not the assigned creative with 403", async () => {
    const { ticket, customer } = await seedAssignedTicket();
    mockGetUser.mockResolvedValue({
      id: customer.id,
      email: "c@test.local",
      role: "CUSTOMER",
    });

    const res = await completeTicket(dummyReq(), completeCtx(ticket.id));
    expect(res.status).toBe(403);
    expect(await prisma.tokenLedger.count({ where: { ticketId: ticket.id } })).toBe(0);
  });

  it("rejects a different creative (not the assignee) with 403", async () => {
    const { ticket } = await seedAssignedTicket();
    const otherCreative = await createUser({ role: "DESIGNER" });
    mockGetUser.mockResolvedValue({
      id: otherCreative.id,
      email: "d@test.local",
      role: "DESIGNER",
    });

    const res = await completeTicket(dummyReq(), completeCtx(ticket.id));
    expect(res.status).toBe(403);
  });

  it("allows the assigned creative and applies the payout", async () => {
    const { ticket, creative } = await seedAssignedTicket();
    mockGetUser.mockResolvedValue({
      id: creative.id,
      email: "assignee@test.local",
      role: "DESIGNER",
    });

    const res = await completeTicket(dummyReq(), completeCtx(ticket.id));
    expect(res.status).toBe(200);

    const t = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(t.status).toBe("DONE");
    // A payout was applied (exact amount is covered in token-accounting.test.ts).
    expect(await getUserTokenBalance(creative.id)).toBeGreaterThan(0);
  });

  it("allows a site admin to complete", async () => {
    const { ticket, creative } = await seedAssignedTicket();
    mockGetUser.mockResolvedValue({
      id: (await createUser({ role: "SITE_ADMIN" })).id,
      email: "admin@test.local",
      role: "SITE_ADMIN",
    });

    const res = await completeTicket(dummyReq(), completeCtx(ticket.id));
    expect(res.status).toBe(200);
    expect(await getUserTokenBalance(creative.id)).toBeGreaterThan(0);
  });
});

describe("PATCH /api/customer/members/[memberId] — granting OWNER is owner-only", () => {
  async function seedCompanyWith(actorRole: "OWNER" | "PM") {
    const company = await createCompany();
    const actor = await createUser({ role: "CUSTOMER" });
    const targetUser = await createUser({ role: "CUSTOMER" });
    await addCompanyMember(company.id, actor.id, actorRole);
    // Keep at least one real OWNER so demotion guards etc. are well-defined.
    const owner = await createUser({ role: "CUSTOMER" });
    await addCompanyMember(company.id, owner.id, "OWNER");
    const targetMember = await addCompanyMember(company.id, targetUser.id, "MEMBER");
    return { company, actor, targetMember };
  }

  function actAs(user: { id: string; companyId: string; companyRole: "OWNER" | "PM" }) {
    mockGetUser.mockResolvedValue({
      id: user.id,
      email: "actor@test.local",
      role: "CUSTOMER",
      activeCompanyId: user.companyId,
      companyRole: user.companyRole,
    });
  }

  it("blocks a PM from granting OWNER (403) and leaves the target unchanged", async () => {
    const { company, actor, targetMember } = await seedCompanyWith("PM");
    actAs({ id: actor.id, companyId: company.id, companyRole: "PM" });

    const req = new Request(`http://localhost/api/customer/members/${targetMember.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roleInCompany: "OWNER" }),
    });
    const res = await patchMember(req as any, memberCtx(targetMember.id));
    expect(res.status).toBe(403);

    const after = await prisma.companyMember.findUniqueOrThrow({ where: { id: targetMember.id } });
    expect(after.roleInCompany).toBe("MEMBER");
  });

  it("allows an OWNER to grant OWNER (200)", async () => {
    const { company, actor, targetMember } = await seedCompanyWith("OWNER");
    actAs({ id: actor.id, companyId: company.id, companyRole: "OWNER" });

    const req = new Request(`http://localhost/api/customer/members/${targetMember.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roleInCompany: "OWNER" }),
    });
    const res = await patchMember(req as any, memberCtx(targetMember.id));
    expect(res.status).toBe(200);

    const after = await prisma.companyMember.findUniqueOrThrow({ where: { id: targetMember.id } });
    expect(after.roleInCompany).toBe("OWNER");
  });

  it("still lets a PM assign non-owner roles (200)", async () => {
    const { company, actor, targetMember } = await seedCompanyWith("PM");
    actAs({ id: actor.id, companyId: company.id, companyRole: "PM" });

    const req = new Request(`http://localhost/api/customer/members/${targetMember.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roleInCompany: "PM" }),
    });
    const res = await patchMember(req as any, memberCtx(targetMember.id));
    expect(res.status).toBe(200);

    const after = await prisma.companyMember.findUniqueOrThrow({ where: { id: targetMember.id } });
    expect(after.roleInCompany).toBe("PM");
  });
});
