// -----------------------------------------------------------------------------
// @file: tests/integration/moodboard-comments.test.ts
// @purpose: Comments on moodboard objects against a real Postgres: who can
//           read and write them, who is notified, and what happens to
//           threads on resolve, reply, edit and delete.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  getCurrentUserOrThrow: () => mockGetUser(),
}));

import { prisma } from "@/lib/prisma";
import {
  GET as listComments,
  POST as addComment,
} from "@/app/api/moodboards/[moodboardId]/comments/route";
import {
  DELETE as deleteComment,
  PATCH as patchComment,
} from "@/app/api/moodboards/[moodboardId]/comments/[commentId]/route";
import { resetDatabase } from "./helpers/db";
import { addCompanyMember, createCompany, createTicket, createUser } from "./helpers/fixtures";

const BASE = "http://localhost/api/moodboards";

const req = (method: string, body?: unknown) =>
  new NextRequest(`${BASE}/x/comments`, {
    method,
    headers: { "content-type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

type Viewer = {
  id: string;
  role: string;
  name?: string;
  activeCompanyId?: string;
  companyRole?: string;
};
const as = (user: Viewer) => mockGetUser.mockResolvedValue(user);

let customer: Viewer;
let outsider: Viewer;
let creative: Viewer;
let boardId: string;
let itemId: string;

const board = () => ({ params: Promise.resolve({ moodboardId: boardId }) });
const comment = (commentId: string) => ({
  params: Promise.resolve({ moodboardId: boardId, commentId }),
});

async function post(body: unknown) {
  const res = await addComment(req("POST", body), board());
  return { status: res.status, json: await res.json() };
}

const notesFor = (userId: string) =>
  prisma.notification.findMany({ where: { userId, type: "MOODBOARD_COMMENT" } });

beforeEach(async () => {
  await resetDatabase();
  mockGetUser.mockReset();

  const company = await createCompany();
  const otherCompany = await createCompany();
  const customerUser = await createUser({ role: "CUSTOMER" });
  const outsiderUser = await createUser({ role: "CUSTOMER" });
  const creativeUser = await createUser({ role: "DESIGNER" });
  await addCompanyMember(company.id, customerUser.id, "OWNER");
  await addCompanyMember(otherCompany.id, outsiderUser.id, "OWNER");

  customer = {
    id: customerUser.id,
    role: "CUSTOMER",
    name: "Cara Customer",
    activeCompanyId: company.id,
    companyRole: "OWNER",
  };
  outsider = {
    id: outsiderUser.id,
    role: "CUSTOMER",
    activeCompanyId: otherCompany.id,
    companyRole: "OWNER",
  };
  creative = { id: creativeUser.id, role: "DESIGNER", name: "Cem Creative" };

  const ticket = await createTicket({
    companyId: company.id,
    createdById: customerUser.id,
    creativeId: creativeUser.id,
  });

  // A creative's board, shared with the customer on their job: the customer only views it.
  const created = await prisma.moodboard.create({
    data: {
      title: "Logo ideas",
      createdById: creativeUser.id,
      ticketId: ticket.id,
      sharedWithCustomer: true,
    } as never,
  });
  boardId = created.id;
  itemId = (
    await prisma.moodboardItem.create({
      data: {
        moodboardId: boardId,
        type: "NOTE",
        data: { body: "Wordmark" },
        createdById: creativeUser.id,
      },
    })
  ).id;
});

describe("moodboard comments", () => {
  it("lets a viewer comment, and tells the board's maker, not the author", async () => {
    as(customer);
    const { status, json } = await post({ itemId, body: "  Can we try it bolder?  " });
    expect(status).toBe(201);
    expect(json.threads).toHaveLength(1);
    expect(json.threads[0]).toMatchObject({
      itemId,
      body: "Can we try it bolder?",
      resolvedAt: null,
    });
    expect(json.viewer).toEqual({ id: customer.id, canModerate: false });

    const [note] = await notesFor(creative.id);
    expect(note).toMatchObject({ moodboardId: boardId, actorId: customer.id });
    expect(note.message).toContain("Cara Customer: Can we try it bolder?");
    expect(await notesFor(customer.id)).toHaveLength(0);
  });

  it("tells everyone in the thread about a reply, and a reply reopens a resolved thread", async () => {
    as(customer);
    const threadId = (await post({ itemId, body: "Bolder?" })).json.threads[0].id;

    as(creative);
    await patchComment(req("PATCH", { resolved: true }), comment(threadId));
    const { json } = await post({ threadId, body: "Done, have a look" });
    expect(json.threads[0].replies).toHaveLength(1);
    expect(json.threads[0].resolvedAt).toBeNull();

    // The creative made the board and wrote the reply: only the customer hears about it.
    expect(await notesFor(customer.id)).toHaveLength(1);
    expect(await notesFor(creative.id)).toHaveLength(1);
  });

  it("doesn't notify someone who can no longer see the board", async () => {
    as(creative);
    const threadId = (await post({ itemId, body: "First idea" })).json.threads[0].id;
    as(customer);
    await post({ threadId, body: "Nice" });
    expect(await notesFor(creative.id)).toHaveLength(1);

    // The creative stops sharing; the customer's later reply reaches the creative only.
    await prisma.moodboard.update({ where: { id: boardId }, data: { sharedWithCustomer: false } });
    as(creative);
    await post({ threadId, body: "Changed it" });
    expect(await notesFor(customer.id)).toHaveLength(0);
  });

  it("keeps outsiders out", async () => {
    as(outsider);
    expect((await listComments(req("GET"), board())).status).toBe(404);
    expect((await post({ itemId, body: "Hi" })).status).toBe(404);
  });

  it("rejects empty or overlong comments", async () => {
    as(customer);
    expect((await post({ itemId, body: "   " })).status).toBe(400);
    expect((await post({ itemId, body: "x".repeat(2001) })).status).toBe(400);
  });

  it("lets only the author edit, and the author or an admin delete", async () => {
    as(customer);
    const threadId = (await post({ itemId, body: "Bolder?" })).json.threads[0].id;
    as(creative);
    await post({ threadId, body: "Sure" });

    expect((await patchComment(req("PATCH", { body: "Edited" }), comment(threadId))).status).toBe(
      403,
    );
    expect((await deleteComment(req("DELETE"), comment(threadId))).status).toBe(403);

    as(customer);
    const edited = await patchComment(req("PATCH", { body: "Much bolder?" }), comment(threadId));
    expect((await edited.json()).threads[0].body).toBe("Much bolder?");

    // Deleting the first comment takes its replies with it.
    as({ id: "admin", role: "SITE_ADMIN" });
    const deleted = await deleteComment(req("DELETE"), comment(threadId));
    expect((await deleted.json()).threads).toHaveLength(0);
    expect(await prisma.moodboardComment.count()).toBe(0);
  });

  it("hides threads on deleted objects", async () => {
    as(customer);
    await post({ itemId, body: "Bolder?" });
    await prisma.moodboardItem.update({ where: { id: itemId }, data: { deletedAt: new Date() } });
    const res = await listComments(req("GET"), board());
    expect((await res.json()).threads).toHaveLength(0);
  });
});
