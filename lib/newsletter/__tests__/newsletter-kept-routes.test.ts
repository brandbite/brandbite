// @vitest-environment node
// Blocks kept for reuse and a newsletter's earlier versions belong to a
// company on a plan, like the newsletters themselves. Who may reach them, that
// one company never reaches another's, and when a version is written, is
// checked here.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getToolAccess, blocks, versions, newsletters } = vi.hoisted(() => ({
  getToolAccess: vi.fn(),
  blocks: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  versions: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  newsletters: { findFirst: vi.fn(), update: vi.fn() },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/tools/entitlement.server", () => ({ getToolAccess: () => getToolAccess() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { newsletterSavedBlock: blocks, newsletterVersion: versions, newsletter: newsletters },
}));

import { PATCH } from "@/app/api/newsletters/[id]/route";
import { GET as oneVersion } from "@/app/api/newsletters/[id]/versions/[versionId]/route";
import { GET as listVersions } from "@/app/api/newsletters/[id]/versions/route";
import { DELETE as deleteBlock } from "@/app/api/newsletters/blocks/[id]/route";
import { GET as listBlocks, POST as keepBlock } from "@/app/api/newsletters/blocks/route";
import { EMPTY_NEWSLETTER, newBlock } from "@/lib/newsletter/newsletter";
import {
  placeSavedBlock,
  SAVED_BLOCKS_MAX,
  savedBlockName,
  VERSION_EVERY_MS,
  VERSIONS_MAX,
} from "@/lib/newsletter/saved";

const PRO = {
  entitlement: { signedIn: true, pro: true, reason: null },
  userId: "user-1",
  userEmail: "me@acme.test",
  companyId: "company-1",
  companyName: "Acme",
  brandColors: [],
};
const NO_PLAN = { ...PRO, entitlement: { signedIn: true, pro: false, reason: "noPlan" } };
const SIGNED_OUT = { ...PRO, entitlement: { signedIn: false, pro: false }, userId: null };

const BLOCK = { ...newBlock("text", "t1"), text: "Thanks for reading." };
const DATA = { ...EMPTY_NEWSLETTER, name: "March", subject: "Hi", blocks: [BLOCK] };

const json = (method: string, body?: unknown) =>
  new Request("http://localhost/api/newsletters", {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }) as never;
const at = <T extends object>(params: T) => ({ params: Promise.resolve(params) });

beforeEach(() => {
  vi.clearAllMocks();
  getToolAccess.mockResolvedValue(PRO);
  blocks.findMany.mockResolvedValue([{ id: "b1", name: "Sign-off", data: BLOCK }]);
  blocks.count.mockResolvedValue(0);
  blocks.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "new",
    ...data,
  }));
  blocks.deleteMany.mockResolvedValue({ count: 1 });
  versions.findMany.mockResolvedValue([]);
  versions.findFirst.mockResolvedValue(null);
  versions.create.mockResolvedValue({ id: "v1" });
  versions.deleteMany.mockResolvedValue({ count: 0 });
  newsletters.findFirst.mockResolvedValue({ id: "n1", data: DATA });
  newsletters.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "n1",
    name: "March",
    data: DATA,
    isTemplate: false,
    updatedAt: new Date(),
    ...data,
  }));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("blocks kept for reuse", () => {
  it("are for signed-in customers on a plan only", async () => {
    for (const [access, status] of [
      [SIGNED_OUT, 401],
      [NO_PLAN, 403],
    ] as const) {
      getToolAccess.mockResolvedValue(access);
      expect((await listBlocks()).status).toBe(status);
      expect((await keepBlock(json("POST", { block: BLOCK }))).status).toBe(status);
      expect((await deleteBlock(json("DELETE"), at({ id: "b1" }))).status).toBe(status);
    }
    expect(blocks.create).not.toHaveBeenCalled();
    expect(blocks.deleteMany).not.toHaveBeenCalled();
  });

  it("are listed for the company and kept clean, with a name from their words", async () => {
    expect(await (await listBlocks()).json()).toEqual({
      blocks: [{ id: "b1", name: "Sign-off", block: BLOCK }],
    });
    expect(blocks.findMany.mock.calls[0][0].where).toEqual({ companyId: "company-1" });

    const res = await keepBlock(json("POST", { block: { ...BLOCK, junk: "<script>" } }));
    expect(res.status).toBe(201);
    const stored = blocks.create.mock.calls[0][0].data;
    expect(stored).toMatchObject({
      name: "Text: Thanks for reading.",
      companyId: "company-1",
      createdById: "user-1",
    });
    expect(stored.data).not.toHaveProperty("junk");
  });

  it("refuse what isn't a block, stop at the limit and never delete another company's", async () => {
    expect((await keepBlock(json("POST", { block: { type: "virus" } }))).status).toBe(400);
    blocks.count.mockResolvedValue(SAVED_BLOCKS_MAX);
    expect((await keepBlock(json("POST", { block: BLOCK }))).status).toBe(409);
    expect(blocks.create).not.toHaveBeenCalled();
    blocks.deleteMany.mockResolvedValue({ count: 0 });
    expect((await deleteBlock(json("DELETE"), at({ id: "theirs" }))).status).toBe(404);
    expect(blocks.deleteMany.mock.calls[0][0].where).toEqual({
      id: "theirs",
      companyId: "company-1",
    });
  });

  it("go into a newsletter as a copy with ids of its own", () => {
    const columns = {
      ...newBlock("columns", "c"),
      cells: [[BLOCK], []],
    };
    let n = 0;
    const placed = placeSavedBlock({ id: "b1", name: "x", block: columns }, () => `new${(n += 1)}`);
    expect(placed.id).toBe("new1");
    expect(placed.type === "columns" && placed.cells[0][0].id).toBe("new2");
    expect(savedBlockName(newBlock("divider", "d"))).toBe("Divider");
    expect(savedBlockName({ ...newBlock("product", "p"), name: "Candle" })).toBe("Product: Candle");
  });
});

describe("earlier versions", () => {
  it("are written when a newsletter is saved, with what it was before the change", async () => {
    await PATCH(json("PATCH", { data: { ...DATA, subject: "Changed" } }), at({ id: "n1" }));
    expect(versions.create).toHaveBeenCalledTimes(1);
    const kept = versions.create.mock.calls[0][0].data;
    expect(kept).toMatchObject({ newsletterId: "n1", createdById: "user-1" });
    expect(kept.data.subject).toBe("Hi");
  });

  it("are not written again within a few minutes, nor for a rename", async () => {
    versions.findFirst.mockResolvedValue({
      createdAt: new Date(Date.now() - VERSION_EVERY_MS / 2),
    });
    await PATCH(json("PATCH", { data: DATA }), at({ id: "n1" }));
    expect(versions.create).not.toHaveBeenCalled();
    versions.findFirst.mockResolvedValue(null);
    await PATCH(json("PATCH", { name: "April" }), at({ id: "n1" }));
    expect(versions.create).not.toHaveBeenCalled();
  });

  it("drop the oldest beyond the limit, and never stop the save when they fail", async () => {
    versions.findMany.mockResolvedValue([{ id: "old1" }, { id: "old2" }]);
    await PATCH(json("PATCH", { data: DATA }), at({ id: "n1" }));
    expect(versions.findMany.mock.calls[0][0]).toMatchObject({ skip: VERSIONS_MAX });
    expect(versions.deleteMany.mock.calls[0][0].where).toEqual({ id: { in: ["old1", "old2"] } });

    versions.findFirst.mockRejectedValue(new Error("down"));
    const res = await PATCH(json("PATCH", { data: DATA }), at({ id: "n1" }));
    expect(res.status).toBe(200);
    expect(newsletters.update).toHaveBeenCalledTimes(2);
  });

  it("are listed and opened only inside the asker's company", async () => {
    versions.findMany.mockResolvedValue([
      { id: "v1", createdAt: new Date("2026-11-26T10:00:00Z"), createdBy: { name: "Ada" } },
    ]);
    expect(await (await listVersions(json("GET"), at({ id: "n1" }))).json()).toEqual({
      versions: [{ id: "v1", createdAt: "2026-11-26T10:00:00.000Z", by: "Ada" }],
    });
    expect(versions.findMany.mock.calls[0][0].where).toEqual({
      newsletterId: "n1",
      newsletter: { companyId: "company-1" },
    });

    versions.findFirst.mockResolvedValue({ data: DATA });
    const one = await oneVersion(json("GET"), at({ id: "n1", versionId: "v1" }));
    expect((await one.json()).data.subject).toBe("Hi");
    expect(versions.findFirst.mock.calls[0][0].where).toEqual({
      id: "v1",
      newsletterId: "n1",
      newsletter: { companyId: "company-1" },
    });
    versions.findFirst.mockResolvedValue(null);
    expect((await oneVersion(json("GET"), at({ id: "n1", versionId: "x" }))).status).toBe(404);

    getToolAccess.mockResolvedValue(NO_PLAN);
    expect((await listVersions(json("GET"), at({ id: "n1" }))).status).toBe(403);
    expect((await oneVersion(json("GET"), at({ id: "n1", versionId: "v1" }))).status).toBe(403);
  });
});
