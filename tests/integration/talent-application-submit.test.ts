// -----------------------------------------------------------------------------
// @file: tests/integration/talent-application-submit.test.ts
// @purpose: End-to-end coverage for POST /api/talent/applications. Exercises
//           the full route — Zod validation, per-IP / per-email rate-limit
//           buckets, the JobTypeCategory cross-validation guard, and the
//           Prisma write — against a real database.
//
//           Turnstile fails open when TURNSTILE_SECRET_KEY is unset (per
//           lib/turnstile.ts policy for dev/CI), so these tests don't need
//           a real Cloudflare key. The token field is validated only as
//           "non-empty string" by the schema.
// -----------------------------------------------------------------------------

import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

import { resetDatabase } from "./helpers/db";

type RouteModule = typeof import("@/app/api/talent/applications/route");
let route: RouteModule;

beforeAll(async () => {
  // Make sure Turnstile fails-open for these tests; we test the gate's
  // behavior elsewhere.
  delete process.env.TURNSTILE_SECRET_KEY;
  route = await import("@/app/api/talent/applications/route");
});

beforeEach(async () => {
  await resetDatabase();
});

afterEach(async () => {
  // Clear in-memory rate-limit buckets between tests so each test starts
  // fresh. The in-memory limiter exposes its bucket store via module
  // state in lib/rate-limit.ts; the simplest cross-test reset is to use
  // a unique IP per test (see makeRequest) rather than reach into the
  // module. Documented here so a future maintainer doesn't grep for a
  // teardown call that doesn't exist.
});

/** Build a NextRequest with a unique IP so per-IP rate buckets don't
 *  leak across tests. The route reads x-forwarded-for first via
 *  getClientIp(). */
function makeRequest(body: unknown, ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.1`): NextRequest {
  return new NextRequest("http://localhost:3000/api/talent/applications", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

async function seedThreeCategories(): Promise<string[]> {
  const created = await Promise.all(
    [0, 1, 2].map((i) =>
      prisma.jobTypeCategory.create({
        data: {
          name: `Test Category ${i}`,
          slug: `test-category-${i}`,
          sortOrder: i,
          isActive: true,
        },
        select: { id: true },
      }),
    ),
  );
  return created.map((c) => c.id);
}

function validBody(categoryIds: string[], overrides: Record<string, unknown> = {}) {
  return {
    fullName: "Jane Designer",
    whatsappNumber: "+90 555 555 5555",
    email: `jane+${Math.random().toString(36).slice(2, 8)}@example.com`,
    country: "Türkiye",
    timezone: "Europe/Istanbul",
    portfolioUrl: "https://jane.design",
    linkedinUrl: null,
    socialLinks: [],
    categoryIds,
    totalYears: "5-10",
    hasRemoteExp: false,
    yearsRemote: null,
    workedWith: ["STARTUPS"],
    workload: "PART_TIME",
    preferredTasksPerWeek: null,
    turnaroundOk: true,
    turnaroundComment: "",
    tools: ["FIGMA"],
    toolsOther: null,
    testTaskOk: true,
    communicationConfirmed: true,
    turnstileToken: "test-token-fail-open",
    ...overrides,
  };
}

describe("POST /api/talent/applications", () => {
  it("creates a TalentApplication on a valid submission", async () => {
    const categoryIds = await seedThreeCategories();
    const body = validBody(categoryIds);

    const res = await route.POST(makeRequest(body));
    expect(res.status).toBe(201);

    const json = (await res.json()) as { id?: string };
    expect(typeof json.id).toBe("string");

    const row = await prisma.talentApplication.findUniqueOrThrow({
      where: { id: json.id! },
    });
    expect(row.email).toBe(body.email);
    expect(row.status).toBe("SUBMITTED");
    // JSON columns round-trip through Prisma as JsonValue — coerce to
    // plain arrays for the comparison.
    expect(row.categoryIds as unknown).toEqual(categoryIds);
    expect(row.tools as unknown).toEqual(["FIGMA"]);
    expect(row.workedWith as unknown).toEqual(["STARTUPS"]);
  });

  it("returns 400 on a malformed body", async () => {
    const res = await route.POST(makeRequest({ email: "not-an-email" }));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error?: string };
    expect(typeof json.error).toBe("string");
  });

  it("rejects a payload referencing a non-existent category", async () => {
    const categoryIds = await seedThreeCategories();
    // Replace one valid id with garbage.
    const body = validBody([categoryIds[0]!, categoryIds[1]!, "clxxx_does_not_exist_aaaaaaa"]);
    const res = await route.POST(makeRequest(body));
    expect(res.status).toBe(400);
    const count = await prisma.talentApplication.count();
    expect(count).toBe(0);
  });

  it("rejects a payload referencing an inactive category", async () => {
    const ids = await seedThreeCategories();
    // Flip one to inactive after seeding.
    await prisma.jobTypeCategory.update({
      where: { id: ids[0]! },
      data: { isActive: false },
    });
    const res = await route.POST(makeRequest(validBody(ids)));
    expect(res.status).toBe(400);
  });

  it("rate-limits the same email after 5 successful submissions in the window", async () => {
    const categoryIds = await seedThreeCategories();
    // Fixed email for the bucket key. Vary IP per request so we hit the
    // per-email cap rather than the per-IP cap.
    const email = `burst-${Date.now()}@example.com`;
    const responses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await route.POST(makeRequest(validBody(categoryIds, { email }), `10.0.${i}.1`));
      responses.push(res.status);
    }
    // First 5 land; 6th is throttled.
    expect(responses.slice(0, 5).every((s) => s === 201)).toBe(true);
    expect(responses[5]).toBe(429);
    const count = await prisma.talentApplication.count({ where: { email } });
    expect(count).toBe(5);
  });

  it("persists ipAddress and userAgent for spam triage", async () => {
    const categoryIds = await seedThreeCategories();
    const req = new NextRequest("http://localhost:3000/api/talent/applications", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.42",
        "user-agent": "Mozilla/5.0 (test)",
      },
      body: JSON.stringify(validBody(categoryIds)),
    });
    const res = await route.POST(req);
    expect(res.status).toBe(201);
    const json = (await res.json()) as { id: string };
    const row = await prisma.talentApplication.findUniqueOrThrow({ where: { id: json.id } });
    expect(row.ipAddress).toBe("203.0.113.42");
    expect(row.userAgent).toBe("Mozilla/5.0 (test)");
  });
});
