// -----------------------------------------------------------------------------
// @file: tests/integration/faq-audience.test.ts
// @purpose: Questions written for creatives reach creatives only, and creatives
//           don't get the questions written for customers.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }));

vi.mock("@/lib/auth", () => ({
  getCurrentUserOrThrow: () => mockGetUser(),
}));

import { GET as creativeFaq } from "@/app/api/creative/faq/route";
import { GET as publicFaq } from "@/app/api/faq/route";
import { CREATIVE_FAQ_CATEGORY } from "@/lib/faq/audience";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "./helpers/db";

beforeEach(async () => {
  await resetDatabase();
  mockGetUser.mockReset();
  await prisma.faq.createMany({
    data: [
      { question: "For customers", answer: "a", category: "General" },
      { question: "For creatives", answer: "b", category: CREATIVE_FAQ_CATEGORY },
      { question: "Hidden", answer: "c", category: CREATIVE_FAQ_CATEGORY, isActive: false },
    ],
  });
});

describe("FAQ audience", () => {
  it("keeps creative questions out of the public FAQ", async () => {
    const json = await (await publicFaq()).json();
    expect(json.faqs.map((f: { question: string }) => f.question)).toEqual(["For customers"]);
    expect(json.categories).toEqual(["General"]);
  });

  it("gives creatives only their own active questions", async () => {
    mockGetUser.mockResolvedValue({ id: "c1", role: "DESIGNER" });
    const json = await (await creativeFaq()).json();
    expect(json.faqs.map((f: { question: string }) => f.question)).toEqual(["For creatives"]);
  });

  it("refuses customers and signed-out visitors", async () => {
    mockGetUser.mockResolvedValue({ id: "u1", role: "CUSTOMER" });
    expect((await creativeFaq()).status).toBe(403);

    mockGetUser.mockRejectedValue(Object.assign(new Error("no"), { code: "UNAUTHENTICATED" }));
    expect((await creativeFaq()).status).toBe(401);
  });
});
