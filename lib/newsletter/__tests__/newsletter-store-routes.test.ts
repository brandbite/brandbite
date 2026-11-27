// @vitest-environment node
// Newsletters kept in an account belong to a company on a plan, and a test
// email goes to the signed-in person's own address and nowhere else. Who may
// do what, and that nothing leaves one company for another, is checked here.
import { beforeEach, describe, expect, it, vi } from "vitest";

const getToolAccess = vi.fn();
const rateLimit = vi.fn();
const sendEmail = vi.fn();
const db = {
  findMany: vi.fn(),
  findFirst: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deleteMany: vi.fn(),
};

vi.mock("server-only", () => ({}));
vi.mock("@/lib/tools/entitlement.server", () => ({ getToolAccess: () => getToolAccess() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: (...args: unknown[]) => rateLimit(...args) }));
vi.mock("@/lib/email", () => ({ sendEmail: (...args: unknown[]) => sendEmail(...args) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    newsletter: {
      findMany: (...args: unknown[]) => db.findMany(...args),
      findFirst: (...args: unknown[]) => db.findFirst(...args),
      count: (...args: unknown[]) => db.count(...args),
      create: (...args: unknown[]) => db.create(...args),
      update: (...args: unknown[]) => db.update(...args),
      deleteMany: (...args: unknown[]) => db.deleteMany(...args),
    },
  },
}));

import { DELETE, GET as getOne, PATCH } from "@/app/api/newsletters/[id]/route";
import { GET as list, POST as create } from "@/app/api/newsletters/route";
import { POST as sendTest } from "@/app/api/tools/newsletter-test/route";
import { EMPTY_NEWSLETTER, newBlock, NEWSLETTER_MAX_SAVED } from "@/lib/newsletter/newsletter";

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

const DATA = {
  ...EMPTY_NEWSLETTER,
  name: "March",
  subject: "Spring menu",
  blocks: [{ ...newBlock("heading", "h1"), text: "Hello" }],
};
const row = (more: Record<string, unknown> = {}) => ({
  id: "n1",
  name: "March",
  data: DATA,
  isTemplate: false,
  updatedAt: new Date("2026-11-26T10:00:00Z"),
  ...more,
});

const json = (method: string, body?: unknown) =>
  new Request("http://localhost/api/newsletters", {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }) as never;
const at = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  getToolAccess.mockResolvedValue(PRO);
  rateLimit.mockResolvedValue({ allowed: true });
  sendEmail.mockResolvedValue({ ok: true });
  db.findMany.mockResolvedValue([row()]);
  db.findFirst.mockResolvedValue(row());
  db.count.mockResolvedValue(0);
  db.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
    row({ ...data, id: "new" }),
  );
  db.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => row(data));
  db.deleteMany.mockResolvedValue({ count: 1 });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("kept newsletters", () => {
  it("are for signed-in customers on a plan only", async () => {
    for (const [access, status] of [
      [SIGNED_OUT, 401],
      [NO_PLAN, 403],
    ] as const) {
      getToolAccess.mockResolvedValue(access);
      expect((await list()).status).toBe(status);
      expect((await create(json("POST", { data: DATA }))).status).toBe(status);
      expect((await getOne(json("GET"), at("n1"))).status).toBe(status);
      expect((await PATCH(json("PATCH", { name: "x" }), at("n1"))).status).toBe(status);
      expect((await DELETE(json("DELETE"), at("n1"))).status).toBe(status);
    }
    expect(db.findMany).not.toHaveBeenCalled();
    expect(db.create).not.toHaveBeenCalled();
    expect(db.deleteMany).not.toHaveBeenCalled();
  });

  it("lists the company's own, newest first", async () => {
    const res = await list();
    expect(await res.json()).toEqual({
      newsletters: [
        {
          id: "n1",
          name: "March",
          subject: "Spring menu",
          isTemplate: false,
          updatedAt: "2026-11-26T10:00:00.000Z",
        },
      ],
      limit: NEWSLETTER_MAX_SAVED,
    });
    expect(db.findMany.mock.calls[0][0]).toMatchObject({
      where: { companyId: "company-1" },
      orderBy: { updatedAt: "desc" },
    });
  });

  it("stores a cleaned copy under the company and the person who made it", async () => {
    const res = await create(
      json("POST", {
        data: {
          ...DATA,
          name: "  Spring  issue ",
          junk: "<script>",
          blocks: [...DATA.blocks, { type: "virus" }],
        },
      }),
    );
    expect(res.status).toBe(201);
    const stored = db.create.mock.calls[0][0].data;
    expect(stored).toMatchObject({
      name: "Spring issue",
      companyId: "company-1",
      createdById: "user-1",
    });
    expect(stored.data.name).toBe("Spring issue");
    expect(stored.data.blocks).toHaveLength(1);
    expect(stored.data).not.toHaveProperty("junk");
  });

  it("refuses what isn't a newsletter, and a company that is at its limit", async () => {
    expect((await create(json("POST", { data: "nope" }))).status).toBe(400);
    db.count.mockResolvedValue(NEWSLETTER_MAX_SAVED);
    const res = await create(json("POST", { data: DATA }));
    expect(res.status).toBe(409);
    expect(db.create).not.toHaveBeenCalled();
  });

  it("never opens, changes or deletes another company's", async () => {
    db.findFirst.mockResolvedValue(null);
    db.deleteMany.mockResolvedValue({ count: 0 });
    expect((await getOne(json("GET"), at("theirs"))).status).toBe(404);
    expect((await PATCH(json("PATCH", { data: DATA }), at("theirs"))).status).toBe(404);
    expect((await DELETE(json("DELETE"), at("theirs"))).status).toBe(404);
    expect(db.update).not.toHaveBeenCalled();
    for (const call of [...db.findFirst.mock.calls, ...db.deleteMany.mock.calls]) {
      expect(call[0].where).toMatchObject({ id: "theirs", companyId: "company-1" });
    }
  });

  it("saves changes, renames the document with the row, and marks a template", async () => {
    await PATCH(json("PATCH", { data: { ...DATA, name: "April" } }), at("n1"));
    expect(db.update.mock.calls[0][0].data).toMatchObject({ name: "April" });
    await PATCH(json("PATCH", { name: "May" }), at("n1"));
    expect(db.update.mock.calls[1][0].data).toMatchObject({ name: "May", data: { name: "May" } });
    await PATCH(json("PATCH", { isTemplate: true }), at("n1"));
    expect(db.update.mock.calls[2][0].data).toEqual({ isTemplate: true });
    expect((await PATCH(json("PATCH", {}), at("n1"))).status).toBe(400);
    expect((await PATCH(json("PATCH", { name: "   " }), at("n1"))).status).toBe(400);
  });
});

describe("POST /api/tools/newsletter-test", () => {
  const request = (body: unknown = { data: DATA, to: "someone-else@example.com" }) =>
    json("POST", body);

  it("sends to the signed-in person's own address, whatever the request says", async () => {
    const res = await sendTest(request());
    expect(await res.json()).toEqual({ ok: true, to: "me@acme.test" });
    const [to, subject, html, text] = sendEmail.mock.calls[0];
    expect(to).toBe("me@acme.test");
    expect(subject).toBe("[Test] Spring menu");
    expect(html).toContain("Hello");
    expect(html).not.toContain("UNSUB");
    expect(text).toContain("HELLO");
    expect(rateLimit).toHaveBeenCalledWith("newsletter-test:user-1", {
      limit: 15,
      windowSeconds: 86_400,
    });
  });

  it("turns away visitors, companies without a plan and empty newsletters", async () => {
    getToolAccess.mockResolvedValue(SIGNED_OUT);
    expect((await sendTest(request())).status).toBe(401);
    getToolAccess.mockResolvedValue(NO_PLAN);
    expect((await sendTest(request())).status).toBe(403);
    getToolAccess.mockResolvedValue(PRO);
    expect((await sendTest(request({ data: { ...DATA, blocks: [] } }))).status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("stops at the daily limit, and says so when the email didn't go out", async () => {
    rateLimit.mockResolvedValueOnce({ allowed: false });
    expect((await sendTest(request())).status).toBe(429);
    expect(sendEmail).not.toHaveBeenCalled();
    sendEmail.mockResolvedValueOnce({ ok: false, reason: "not_configured" });
    expect((await sendTest(request())).status).toBe(503);
    sendEmail.mockResolvedValueOnce({ ok: false, reason: "failed" });
    expect((await sendTest(request())).status).toBe(502);
  });
});
