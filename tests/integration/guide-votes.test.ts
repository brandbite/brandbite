// -----------------------------------------------------------------------------
// @file: tests/integration/guide-votes.test.ts
// @purpose: "Was this helpful?" against a real Postgres: one answer per person
//           per guide, role limits, and totals that never reveal who answered.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  getCurrentUserOrThrow: () => mockGetUser(),
}));

import { prisma } from "@/lib/prisma";
import { GET as adminGet } from "@/app/api/admin/guide-votes/route";
import { GET, PUT } from "@/app/api/support/guide-votes/route";
import { resetDatabase } from "./helpers/db";
import { createUser } from "./helpers/fixtures";

const URL_BASE = "http://localhost/api/support/guide-votes";

function put(body: unknown) {
  return PUT(
    new NextRequest(URL_BASE, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

function get(slug: string) {
  return GET(new NextRequest(`${URL_BASE}?slug=${encodeURIComponent(slug)}`));
}

async function signIn(role: "CUSTOMER" | "DESIGNER" | "SITE_ADMIN" | "SITE_OWNER") {
  const user = await createUser({ role });
  mockGetUser.mockResolvedValue({ id: user.id, role });
  return user;
}

async function adminRows() {
  const res = await adminGet();
  expect(res.status).toBe(200);
  return (await res.json()).rows as Record<string, unknown>[];
}

beforeEach(async () => {
  await resetDatabase();
  mockGetUser.mockReset();
});

describe("/api/support/guide-votes", () => {
  it("is 401 without a session", async () => {
    const err: Error & { code?: string } = new Error("UNAUTHENTICATED");
    err.code = "UNAUTHENTICATED";
    mockGetUser.mockRejectedValue(err);
    expect((await get("tokens")).status).toBe(401);
    expect((await put({ slug: "tokens", helpful: true })).status).toBe(401);
  });

  it("starts with no answer and reads back the person's own", async () => {
    await signIn("CUSTOMER");
    expect(await (await get("tokens")).json()).toEqual({ helpful: null });

    expect((await put({ slug: "tokens", helpful: false })).status).toBe(200);
    expect(await (await get("tokens")).json()).toEqual({ helpful: false });
  });

  it("keeps one answer per person when they change it", async () => {
    await signIn("CUSTOMER");
    await put({ slug: "tokens", helpful: false });
    await put({ slug: "tokens", helpful: true });

    const votes = await prisma.guideVote.findMany();
    expect(votes).toHaveLength(1);
    expect(votes[0]).toMatchObject({ audience: "customer", slug: "tokens", helpful: true });
  });

  it("doesn't show one person's answer to another", async () => {
    await signIn("CUSTOMER");
    await put({ slug: "tokens", helpful: true });

    await signIn("CUSTOMER");
    expect(await (await get("tokens")).json()).toEqual({ helpful: null });
  });

  it("files the same slug under the voter's own audience", async () => {
    await signIn("DESIGNER");
    await put({ slug: "withdrawals", helpful: false });
    await signIn("SITE_ADMIN");
    await put({ slug: "withdrawals", helpful: true });

    const votes = await prisma.guideVote.findMany({ orderBy: { audience: "asc" } });
    expect(votes.map((v) => [v.audience, v.helpful])).toEqual([
      ["admin", true],
      ["creative", false],
    ]);
  });

  it("refuses guides the person's role can't read", async () => {
    await signIn("CUSTOMER");
    expect((await put({ slug: "deliver-work", helpful: true })).status).toBe(404);
    expect((await put({ slug: "no-such-guide", helpful: true })).status).toBe(404);
    expect((await get("no-such-guide")).status).toBe(404);
    expect(await prisma.guideVote.count()).toBe(0);
  });

  it("keeps owner-only guides from site admins", async () => {
    await signIn("SITE_ADMIN");
    expect((await put({ slug: "audit-log", helpful: true })).status).toBe(404);

    await signIn("SITE_OWNER");
    expect((await put({ slug: "audit-log", helpful: true })).status).toBe(200);
  });

  it.each([
    [{ slug: "tokens" }],
    [{ slug: "tokens", helpful: "yes" }],
    [{ helpful: true }],
    [null],
  ])("rejects the bad body %j", async (body) => {
    await signIn("CUSTOMER");
    expect((await put(body)).status).toBe(400);
  });

  it("removes a person's answers with their account", async () => {
    const user = await signIn("CUSTOMER");
    await put({ slug: "tokens", helpful: true });
    await prisma.userAccount.delete({ where: { id: user.id } });
    expect(await prisma.guideVote.count()).toBe(0);
  });
});

describe("GET /api/admin/guide-votes", () => {
  it.each(["CUSTOMER", "DESIGNER"] as const)("is 403 for %s", async (role) => {
    await signIn(role);
    expect((await adminGet()).status).toBe(403);
  });

  it("totals each guide, most No answers first, without saying who answered", async () => {
    await signIn("CUSTOMER");
    await put({ slug: "tokens", helpful: true });
    await signIn("CUSTOMER");
    await put({ slug: "tokens", helpful: false });
    await signIn("CUSTOMER");
    await put({ slug: "moodboards", helpful: false });
    await put({ slug: "create-request", helpful: true });
    await signIn("DESIGNER");
    await put({ slug: "withdrawals", helpful: false });

    await signIn("SITE_ADMIN");
    const rows = await adminRows();
    const voted = rows.filter((r) => (r.total as number) > 0);

    expect(voted[0]).toMatchObject({ slug: "tokens", helpful: 1, notHelpful: 1, total: 2 });
    expect(rows.find((r) => r.audience === "creative" && r.slug === "withdrawals")).toMatchObject({
      notHelpful: 1,
    });
    expect(voted.at(-1)).toMatchObject({ slug: "create-request", helpful: 1, notHelpful: 0 });
    expect(JSON.stringify(rows)).not.toMatch(/userId|email/);
  });

  it("lists unanswered guides, and owner-only ones only for owners", async () => {
    await signIn("SITE_ADMIN");
    const forAdmin = await adminRows();
    expect(forAdmin.find((r) => r.slug === "tokens")).toMatchObject({ total: 0 });
    expect(forAdmin.some((r) => r.slug === "audit-log")).toBe(false);

    await signIn("SITE_OWNER");
    expect((await adminRows()).some((r) => r.slug === "audit-log")).toBe(true);
  });
});
