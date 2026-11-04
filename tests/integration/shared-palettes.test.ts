// -----------------------------------------------------------------------------
// @file: tests/integration/shared-palettes.test.ts
// @purpose: Public palette links against a real database: what gets stored, input
//           validation, unguessable ids, and rate limiting.
// -----------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRateLimit } = vi.hoisted(() => ({ mockRateLimit: vi.fn() }));

vi.mock("@/lib/rate-limit", () => ({
  getClientIp: () => "203.0.113.1",
  rateLimit: mockRateLimit,
}));

import { POST } from "@/app/api/colors/shares/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "./helpers/db";

function jsonReq(body: unknown) {
  return new NextRequest("http://localhost/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const BODY = {
  name: "Ocean",
  colors: [
    { id: "a", hex: "#173B59" },
    { id: "b", hex: "#f6e5d5" },
  ],
  roles: { text: "a", background: "b" },
};

beforeEach(async () => {
  await resetDatabase();
  mockRateLimit.mockReset();
  mockRateLimit.mockResolvedValue({ allowed: true, resetAt: Date.now() + 1000 });
});

describe("POST /api/colors/shares", () => {
  it("stores a snapshot under an unguessable id", async () => {
    const res = await POST(jsonReq(BODY));
    expect(res.status).toBe(201);
    const { id } = await res.json();
    expect(id).toMatch(/^[\w-]{22}$/);

    const row = await prisma.sharedPalette.findUniqueOrThrow({ where: { id } });
    expect(row.name).toBe("Ocean");
    expect(row.colors).toEqual([
      { id: "a", hex: "#173b59" },
      { id: "b", hex: "#f6e5d5" },
    ]);
    expect(row.roles).toEqual({ text: "a", background: "b" });
  });

  it("gives each link its own id", async () => {
    const first = await (await POST(jsonReq(BODY))).json();
    const second = await (await POST(jsonReq(BODY))).json();
    expect(first.id).not.toBe(second.id);
  });

  it("stores nothing beyond the name, colors and roles", async () => {
    const res = await POST(
      jsonReq({
        ...BODY,
        id: "chosen-id",
        tags: ["private"],
        email: "someone@test.local",
        colors: [{ id: "a", hex: "#000000", locked: true, note: "private" }],
        roles: { text: "a", accent: "missing" },
      }),
    );
    const { id } = await res.json();
    expect(id).not.toBe("chosen-id");
    const row = await prisma.sharedPalette.findUniqueOrThrow({ where: { id } });
    expect(row.colors).toEqual([{ id: "a", hex: "#000000" }]);
    expect(row.roles).toEqual({ text: "a" });
    expect(JSON.stringify(row)).not.toContain("private");
  });

  it.each([
    ["an invalid color", { colors: [{ id: "a", hex: "url(evil)" }] }],
    ["no colors", { colors: [] }],
    [
      "too many colors",
      { colors: Array.from({ length: 13 }, (_, i) => ({ id: `${i}`, hex: "#000" })) },
    ],
    ["a blank name", { name: " " }],
    ["a long name", { name: "x".repeat(81) }],
  ])("rejects %s", async (_label, change) => {
    const res = await POST(jsonReq({ ...BODY, ...change }));
    expect(res.status).toBe(400);
    expect(await prisma.sharedPalette.count()).toBe(0);
  });

  it("stops creating links when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ allowed: false, resetAt: Date.now() + 30000 });
    const res = await POST(jsonReq(BODY));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(await prisma.sharedPalette.count()).toBe(0);
  });
});
