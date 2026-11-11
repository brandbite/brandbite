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

import { createNotification } from "@/lib/notifications";
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

describe("undoing a version sent for review", () => {
  const send = (id: string) => patchTicket(jsonReq({ id, status: "IN_REVIEW" }));
  const pullBack = (id: string) => patchTicket(jsonReq({ id, status: "IN_PROGRESS" }));

  it("withdraws the version when pulled back within a minute, without telling the customer", async () => {
    vi.mocked(createNotification).mockClear();
    const { ticket } = await seed("IN_PROGRESS");
    const sent = await (await send(ticket.id)).json();
    expect(sent.undoSeconds).toBe(60);
    const asset = await prisma.asset.create({
      data: {
        ticketId: ticket.id,
        revisionId: sent.revisionId,
        kind: "OUTPUT_IMAGE",
        storageKey: "k",
        mimeType: "image/png",
        bytes: 1,
        createdById: ticket.creativeId!,
      },
    });

    const res = await pullBack(ticket.id);
    expect((await res.json()).undone).toBe(true);
    const after = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(after.status).toBe("IN_PROGRESS");
    expect(after.revisionCount).toBe(0);
    expect(await prisma.ticketRevision.count({ where: { ticketId: ticket.id } })).toBe(0);
    const gone = await prisma.asset.findUniqueOrThrow({ where: { id: asset.id } });
    expect(gone.deletedAt).not.toBeNull();
    expect(gone.revisionId).toBeNull();
    expect(createNotification).not.toHaveBeenCalled();

    // Sending again starts from the same version number.
    await send(ticket.id);
    const again = await prisma.ticketRevision.findMany({ where: { ticketId: ticket.id } });
    expect(again.map((r) => r.version)).toEqual([1]);
  });

  it("keeps the version and tells the customer once the minute has passed", async () => {
    const { ticket } = await seed("IN_PROGRESS");
    const sent = await (await send(ticket.id)).json();
    await prisma.ticketRevision.update({
      where: { id: sent.revisionId },
      data: { submittedAt: new Date(Date.now() - 120_000) },
    });
    vi.mocked(createNotification).mockClear();

    const body = await (await pullBack(ticket.id)).json();
    expect(body.undone).toBeUndefined();
    expect(await prisma.ticketRevision.count({ where: { ticketId: ticket.id } })).toBe(1);
    expect(createNotification).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createNotification).mock.calls[0]![0].type).toBe("TICKET_STATUS_CHANGED");
  });

  it("doesn't undo a version the customer already answered", async () => {
    const { ticket } = await seed("IN_PROGRESS");
    const sent = await (await send(ticket.id)).json();
    await prisma.ticketRevision.update({
      where: { id: sent.revisionId },
      data: { feedbackAt: new Date() },
    });
    const body = await (await pullBack(ticket.id)).json();
    expect(body.undone).toBeUndefined();
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
