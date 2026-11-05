// -----------------------------------------------------------------------------
// @file: tests/integration/moodboard-access.test.ts
// @purpose: Who can see and change which moodboard, against a real Postgres.
//           Mostly about what must not leak: other companies, other creatives,
//           and boards a creative hasn't shared.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  getCurrentUserOrThrow: () => mockGetUser(),
}));

import { prisma } from "@/lib/prisma";
import { GET as listBoards, POST as createBoard } from "@/app/api/moodboards/route";
import {
  DELETE as deleteBoard,
  GET as getBoard,
  PATCH as patchBoard,
} from "@/app/api/moodboards/[moodboardId]/route";
import { POST as addItem } from "@/app/api/moodboards/[moodboardId]/items/route";
import { PATCH as patchItem } from "@/app/api/moodboards/[moodboardId]/items/[itemId]/route";
import { resetDatabase } from "./helpers/db";
import { addCompanyMember, createCompany, createTicket, createUser } from "./helpers/fixtures";

const URL_BASE = "http://localhost/api/moodboards";

const json = (url: string, method: string, body?: unknown) =>
  new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

const paramsOf = (moodboardId: string) => ({ params: Promise.resolve({ moodboardId }) });

const as = (user: { id: string; role: string; activeCompanyId?: string; companyRole?: string }) =>
  mockGetUser.mockResolvedValue(user);

const statusOf = async (moodboardId: string) =>
  (await getBoard(json(`${URL_BASE}/${moodboardId}`, "GET"), paramsOf(moodboardId))).status;

const listIds = async (query = "") => {
  const res = await listBoards(json(`${URL_BASE}${query}`, "GET"));
  expect(res.status).toBe(200);
  return (await res.json()).moodboards.map((m: { id: string }) => m.id) as string[];
};

const patchStatus = async (moodboardId: string, body: unknown) =>
  (await patchBoard(json(`${URL_BASE}/${moodboardId}`, "PATCH", body), paramsOf(moodboardId)))
    .status;

let customer: { id: string; role: string; activeCompanyId: string; companyRole: string };
let otherCustomer: { id: string; role: string; activeCompanyId: string; companyRole: string };
let creative: { id: string; role: string };
let otherCreative: { id: string; role: string };
const admin = { id: "admin", role: "SITE_ADMIN" };
const owner = { id: "owner", role: "SITE_OWNER" };

let companyId: string;
let ticketId: string;
let customerBoardId: string;
let customerBoardOnJobId: string;
let creativeBoardId: string;

beforeEach(async () => {
  await resetDatabase();
  mockGetUser.mockReset();

  const company = await createCompany();
  const otherCompany = await createCompany();
  companyId = company.id;

  const customerUser = await createUser({ role: "CUSTOMER" });
  const otherCustomerUser = await createUser({ role: "CUSTOMER" });
  await addCompanyMember(company.id, customerUser.id, "OWNER");
  await addCompanyMember(otherCompany.id, otherCustomerUser.id, "OWNER");
  const creativeUser = await createUser({ role: "DESIGNER" });
  const otherCreativeUser = await createUser({ role: "DESIGNER" });

  customer = {
    id: customerUser.id,
    role: "CUSTOMER",
    activeCompanyId: company.id,
    companyRole: "OWNER",
  };
  otherCustomer = {
    id: otherCustomerUser.id,
    role: "CUSTOMER",
    activeCompanyId: otherCompany.id,
    companyRole: "OWNER",
  };
  creative = { id: creativeUser.id, role: "DESIGNER" };
  otherCreative = { id: otherCreativeUser.id, role: "DESIGNER" };

  const ticket = await createTicket({
    companyId: company.id,
    createdById: customerUser.id,
    creativeId: creativeUser.id,
  });
  ticketId = ticket.id;

  const make = (data: Record<string, unknown>) =>
    prisma.moodboard.create({ data: { title: "Board", ...data } as never });

  customerBoardId = (await make({ companyId: company.id, createdById: customerUser.id })).id;
  customerBoardOnJobId = (
    await make({ companyId: company.id, createdById: customerUser.id, ticketId: ticket.id })
  ).id;
  creativeBoardId = (await make({ createdById: creativeUser.id })).id;
});

describe("a customer", () => {
  it("sees and edits their company's boards", async () => {
    as(customer);
    expect(await statusOf(customerBoardId)).toBe(200);
    expect(await patchStatus(customerBoardId, { title: "New" })).toBe(200);
  });

  it("can't see another company's boards", async () => {
    as(otherCustomer);
    expect(await statusOf(customerBoardId)).toBe(404);
    expect(await patchStatus(customerBoardId, { title: "No" })).toBe(404);
    expect(await listIds()).toEqual([]);
  });

  it("can't see a creative's board, even linked to their job, until it's shared", async () => {
    await prisma.moodboard.update({ where: { id: creativeBoardId }, data: { ticketId } });
    as(customer);
    expect(await statusOf(creativeBoardId)).toBe(404);
    expect(await listIds()).not.toContain(creativeBoardId);
  });

  it("views a shared board without being able to change it", async () => {
    await prisma.moodboard.update({
      where: { id: creativeBoardId },
      data: { ticketId, sharedWithCustomer: true },
    });
    as(customer);
    expect(await statusOf(creativeBoardId)).toBe(200);
    expect(await listIds()).toContain(creativeBoardId);
    expect(await patchStatus(creativeBoardId, { title: "No" })).toBe(403);
    expect(
      (
        await deleteBoard(
          json(`${URL_BASE}/${creativeBoardId}`, "DELETE"),
          paramsOf(creativeBoardId),
        )
      ).status,
    ).toBe(403);
    const res = await addItem(
      json(`${URL_BASE}/${creativeBoardId}/items`, "POST", { type: "NOTE", data: { body: "x" } }),
      paramsOf(creativeBoardId),
    );
    expect(res.status).toBe(403);
  });

  it("doesn't get a board shared with a different company's job", async () => {
    await prisma.moodboard.update({
      where: { id: creativeBoardId },
      data: { ticketId, sharedWithCustomer: true },
    });
    as(otherCustomer);
    expect(await statusOf(creativeBoardId)).toBe(404);
    expect(await listIds()).toEqual([]);
  });

  it("can't change who a board is shared with", async () => {
    as(customer);
    expect(await patchStatus(customerBoardId, { sharedWithCustomer: true })).toBe(403);
    expect(await patchStatus(customerBoardId, { ticketId })).toBe(403);
  });
});

describe("a creative", () => {
  it("creates a board that belongs to no company", async () => {
    as(creative);
    const res = await createBoard(json(URL_BASE, "POST", { title: "Ideas" }));
    expect(res.status).toBe(201);
    const { moodboard } = await res.json();
    const row = await prisma.moodboard.findUnique({ where: { id: moodboard.id } });
    expect(row).toMatchObject({
      companyId: null,
      createdById: creative.id,
      sharedWithCustomer: false,
    });
  });

  it("has full control of their own board", async () => {
    as(creative);
    expect(await patchStatus(creativeBoardId, { title: "Mine" })).toBe(200);
    const res = await addItem(
      json(`${URL_BASE}/${creativeBoardId}/items`, "POST", {
        type: "SHAPE",
        data: { kind: "rect", text: "", fill: "#FFFFFF" },
      }),
      paramsOf(creativeBoardId),
    );
    expect(res.status).toBe(201);
    expect(
      (
        await deleteBoard(
          json(`${URL_BASE}/${creativeBoardId}`, "DELETE"),
          paramsOf(creativeBoardId),
        )
      ).status,
    ).toBe(200);
  });

  it("can't see another creative's board", async () => {
    as(otherCreative);
    expect(await statusOf(creativeBoardId)).toBe(404);
    expect(await patchStatus(creativeBoardId, { title: "No" })).toBe(404);
    expect(await listIds()).toEqual([]);
  });

  it("views the customer's board on their job, and only that one", async () => {
    as(creative);
    expect(await statusOf(customerBoardOnJobId)).toBe(200);
    expect(await statusOf(customerBoardId)).toBe(404);
    const ids = await listIds();
    expect(ids).toContain(customerBoardOnJobId);
    expect(ids).toContain(creativeBoardId);
    expect(ids).not.toContain(customerBoardId);
  });

  it("can't change the customer's board", async () => {
    as(creative);
    expect(await patchStatus(customerBoardOnJobId, { title: "No" })).toBe(403);
    expect(
      (
        await deleteBoard(
          json(`${URL_BASE}/${customerBoardOnJobId}`, "DELETE"),
          paramsOf(customerBoardOnJobId),
        )
      ).status,
    ).toBe(403);

    const item = await prisma.moodboardItem.create({
      data: {
        moodboardId: customerBoardOnJobId,
        type: "NOTE",
        data: { body: "x" },
        createdById: customer.id,
      },
    });
    const res = await patchItem(
      json(`${URL_BASE}/${customerBoardOnJobId}/items/${item.id}`, "PATCH", { x: 5 }),
      { params: Promise.resolve({ moodboardId: customerBoardOnJobId, itemId: item.id }) },
    );
    expect(res.status).toBe(403);
  });

  it("loses the customer's board when the job goes to someone else", async () => {
    await prisma.ticket.update({ where: { id: ticketId }, data: { creativeId: otherCreative.id } });
    as(creative);
    expect(await statusOf(customerBoardOnJobId)).toBe(404);
    as(otherCreative);
    expect(await statusOf(customerBoardOnJobId)).toBe(200);
  });

  it("can only link a board to their own jobs", async () => {
    const otherJob = await createTicket({
      companyId,
      createdById: customer.id,
      creativeId: otherCreative.id,
    });
    as(creative);
    expect(await patchStatus(creativeBoardId, { ticketId: otherJob.id })).toBe(400);
    expect(await patchStatus(creativeBoardId, { ticketId })).toBe(200);

    const res = await createBoard(json(URL_BASE, "POST", { title: "X", ticketId: otherJob.id }));
    expect(res.status).toBe(400);
  });

  it("must link a job before sharing, and moving jobs takes the share back", async () => {
    as(creative);
    expect(await patchStatus(creativeBoardId, { sharedWithCustomer: true })).toBe(400);

    expect(await patchStatus(creativeBoardId, { ticketId, sharedWithCustomer: true })).toBe(200);
    const secondJob = await createTicket({
      companyId,
      createdById: customer.id,
      creativeId: creative.id,
    });
    expect(await patchStatus(creativeBoardId, { ticketId: secondJob.id })).toBe(200);
    expect(await prisma.moodboard.findUnique({ where: { id: creativeBoardId } })).toMatchObject({
      ticketId: secondJob.id,
      sharedWithCustomer: false,
    });

    expect(await patchStatus(creativeBoardId, { sharedWithCustomer: true })).toBe(200);
    expect(await patchStatus(creativeBoardId, { ticketId: null })).toBe(200);
    expect(await prisma.moodboard.findUnique({ where: { id: creativeBoardId } })).toMatchObject({
      ticketId: null,
      sharedWithCustomer: false,
    });
  });

  it("can filter to one job", async () => {
    await prisma.moodboard.update({ where: { id: creativeBoardId }, data: { ticketId } });
    as(creative);
    expect((await listIds(`?ticketId=${ticketId}`)).sort()).toEqual(
      [customerBoardOnJobId, creativeBoardId].sort(),
    );
  });
});

describe("a brandbite admin", () => {
  it.each([
    ["site admin", () => admin],
    ["site owner", () => owner],
  ])("as %s sees every board, including private ones", async (_name, who) => {
    as(who());
    const ids = await listIds();
    expect(ids.sort()).toEqual([customerBoardId, customerBoardOnJobId, creativeBoardId].sort());
    expect(await statusOf(creativeBoardId)).toBe(200);
  });

  it("is told who's behind each board", async () => {
    as(admin);
    const res = await listBoards(json(URL_BASE, "GET"));
    const { moodboards } = await res.json();
    const board = moodboards.find((m: { id: string }) => m.id === creativeBoardId);
    expect(board.createdByName).toBeTruthy();
  });

  it("can't change or delete anything", async () => {
    as(admin);
    expect(await patchStatus(creativeBoardId, { title: "No" })).toBe(403);
    expect(await patchStatus(customerBoardId, { title: "No" })).toBe(403);
    expect(
      (
        await deleteBoard(
          json(`${URL_BASE}/${customerBoardId}`, "DELETE"),
          paramsOf(customerBoardId),
        )
      ).status,
    ).toBe(403);
    expect((await createBoard(json(URL_BASE, "POST", { title: "No" }))).status).toBe(403);
  });
});

describe("what other roles are told", () => {
  it("doesn't name the people behind a board to customers or creatives", async () => {
    as(creative);
    const res = await listBoards(json(URL_BASE, "GET"));
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("createdByName");
    expect(text).not.toContain("companyName");
  });
});

describe("sharing notification", () => {
  const notifications = () => prisma.notification.findMany({ where: { type: "MOODBOARD_SHARED" } });

  beforeEach(async () => {
    await prisma.moodboard.update({ where: { id: creativeBoardId }, data: { ticketId } });
  });

  it("tells the person who created the request, pointing at it", async () => {
    as(creative);
    expect(await patchStatus(creativeBoardId, { sharedWithCustomer: true })).toBe(200);
    const sent = await notifications();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ userId: customer.id, ticketId, actorId: creative.id });
  });

  it("doesn't tell anyone again for later edits to a shared board", async () => {
    as(creative);
    await patchStatus(creativeBoardId, { sharedWithCustomer: true });
    await patchStatus(creativeBoardId, { title: "Renamed" });
    await patchStatus(creativeBoardId, { sharedWithCustomer: true });
    expect(await notifications()).toHaveLength(1);
  });

  it("doesn't notify when sharing stops, or when a board is only linked", async () => {
    as(creative);
    await patchStatus(creativeBoardId, { ticketId });
    expect(await notifications()).toHaveLength(0);

    await patchStatus(creativeBoardId, { sharedWithCustomer: true });
    await patchStatus(creativeBoardId, { sharedWithCustomer: false });
    expect(await notifications()).toHaveLength(1);
  });

  it("respects a customer who turned these off", async () => {
    await prisma.notificationPreference.create({
      data: { userId: customer.id, type: "MOODBOARD_SHARED", enabled: false, emailEnabled: false },
    });
    as(creative);
    expect(await patchStatus(creativeBoardId, { sharedWithCustomer: true })).toBe(200);
    expect(await notifications()).toHaveLength(0);
  });
});
