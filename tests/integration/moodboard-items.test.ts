// -----------------------------------------------------------------------------
// @file: tests/integration/moodboard-items.test.ts
// @purpose: A deleted moodboard item stays recoverable with its file for a day,
//           then goes for good. Only the board's own uploads can be attached.
// -----------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetUser, mockDeleteR2 } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockDeleteR2: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUserOrThrow: () => mockGetUser(),
}));
vi.mock("@/lib/r2", async (original) => ({
  ...(await original<typeof import("@/lib/r2")>()),
  deleteR2Objects: mockDeleteR2,
  resolveAssetUrl: async (key: string) => `https://files.test/${key}`,
}));

import {
  DELETE as deleteItem,
  PATCH as patchItem,
} from "@/app/api/moodboards/[moodboardId]/items/[itemId]/route";
import { POST as addItem } from "@/app/api/moodboards/[moodboardId]/items/route";
import { GET as getBoard } from "@/app/api/moodboards/[moodboardId]/route";
import { GET as listBoards } from "@/app/api/moodboards/route";
import { DELETED_ITEM_KEEP_MS, purgeDeletedMoodboardItems } from "@/lib/moodboard-items";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "./helpers/db";
import { addCompanyMember, createCompany, createUser } from "./helpers/fixtures";

function req(method: string, body?: unknown) {
  return new NextRequest("http://localhost/test", {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function seed() {
  const company = await createCompany();
  const user = await createUser({ role: "CUSTOMER" });
  await addCompanyMember(company.id, user.id, "OWNER");
  mockGetUser.mockResolvedValue({
    id: user.id,
    email: "o@test.local",
    role: "CUSTOMER",
    activeCompanyId: company.id,
    companyRole: "OWNER",
  });
  const board = await prisma.moodboard.create({
    data: { title: "Board", companyId: company.id, createdById: user.id },
  });
  const storageKey = `moodboards/${board.id}/logo.png`;
  const image = await prisma.moodboardItem.create({
    data: {
      moodboardId: board.id,
      type: "IMAGE",
      data: { url: "", storageKey, originalName: "logo.png", mimeType: "image/png", bytes: 1 },
      createdById: user.id,
    },
  });
  return { board, image, storageKey, user };
}

const itemParams = (moodboardId: string, itemId: string) => ({
  params: Promise.resolve({ moodboardId, itemId }),
});
const boardParams = (moodboardId: string) => ({ params: Promise.resolve({ moodboardId }) });

beforeEach(async () => {
  await resetDatabase();
  mockGetUser.mockReset();
  mockDeleteR2.mockReset();
});

describe("deleting a moodboard item", () => {
  it("hides it from the board and its counts, and keeps its file", async () => {
    const { board, image } = await seed();

    const res = await deleteItem(req("DELETE"), itemParams(board.id, image.id));
    expect(res.status).toBe(200);
    expect(mockDeleteR2).not.toHaveBeenCalled();

    const json = await (await getBoard(req("GET"), boardParams(board.id))).json();
    expect(json.moodboard.items).toHaveLength(0);

    const list = await (await listBoards(req("GET"))).json();
    expect(list.moodboards[0].itemCount).toBe(0);
  });

  it("brings it back under the same id", async () => {
    const { board, image } = await seed();
    await deleteItem(req("DELETE"), itemParams(board.id, image.id));

    const res = await patchItem(req("PATCH", { restore: true }), itemParams(board.id, image.id));
    expect(res.status).toBe(200);

    const json = await (await getBoard(req("GET"), boardParams(board.id))).json();
    expect(json.moodboard.items.map((i: { id: string }) => i.id)).toEqual([image.id]);
  });
});

describe("removing deleted items for good", () => {
  const longAgo = () => new Date(Date.now() - DELETED_ITEM_KEEP_MS - 1000);

  it("leaves recent ones, and removes old ones with their file", async () => {
    const { image, storageKey } = await seed();
    await prisma.moodboardItem.update({
      where: { id: image.id },
      data: { deletedAt: new Date() },
    });
    await purgeDeletedMoodboardItems();
    expect(await prisma.moodboardItem.count()).toBe(1);
    expect(mockDeleteR2).not.toHaveBeenCalled();

    await prisma.moodboardItem.update({ where: { id: image.id }, data: { deletedAt: longAgo() } });
    await purgeDeletedMoodboardItems();
    expect(await prisma.moodboardItem.count()).toBe(0);
    expect(mockDeleteR2).toHaveBeenCalledWith([storageKey]);
  });

  it("keeps a file a copy on the board still uses", async () => {
    const { board, image, storageKey, user } = await seed();
    await prisma.moodboardItem.create({
      data: {
        moodboardId: board.id,
        type: "IMAGE",
        data: { url: "", storageKey },
        createdById: user.id,
      },
    });
    await prisma.moodboardItem.update({ where: { id: image.id }, data: { deletedAt: longAgo() } });

    await purgeDeletedMoodboardItems();

    expect(await prisma.moodboardItem.count()).toBe(1);
    expect(mockDeleteR2).toHaveBeenCalledWith([]);
  });
});

describe("attaching files", () => {
  it("accepts a copy of this board's own upload", async () => {
    const { board, storageKey } = await seed();
    const res = await addItem(
      req("POST", { type: "IMAGE", data: { url: "", storageKey } }),
      boardParams(board.id),
    );
    expect(res.status).toBe(201);
  });

  it("refuses a file from anywhere else, when adding or editing", async () => {
    const { board, image } = await seed();
    const foreign = { url: "", storageKey: "tickets/someone-else/brief/secret.pdf" };

    const added = await addItem(
      req("POST", { type: "FILE", data: foreign }),
      boardParams(board.id),
    );
    expect(added.status).toBe(400);

    const edited = await patchItem(req("PATCH", { data: foreign }), itemParams(board.id, image.id));
    expect(edited.status).toBe(400);
  });

  it("still accepts objects with no file", async () => {
    const { board } = await seed();
    const res = await addItem(
      req("POST", { type: "NOTE", data: { body: "Hello" } }),
      boardParams(board.id),
    );
    expect(res.status).toBe(201);
  });
});
