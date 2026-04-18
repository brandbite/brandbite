// -----------------------------------------------------------------------------
// @file: lib/__tests__/rate-limit.test.ts
// @purpose: In-memory rate-limit fallback enforces the window correctly.
//           Upstash path is exercised via integration, not here.
// -----------------------------------------------------------------------------

import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";

// Ensure Upstash env is absent so we exercise the in-memory fallback
const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

import { rateLimit, getClientIp } from "@/lib/rate-limit";

beforeEach(() => {
  vi.useRealTimers();
});

afterAll(() => {
  if (originalUrl !== undefined) process.env.UPSTASH_REDIS_REST_URL = originalUrl;
  if (originalToken !== undefined) process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
});

describe("rateLimit (in-memory fallback)", () => {
  it("allows requests under the limit", async () => {
    const id = `test-allow-${Date.now()}`;
    const first = await rateLimit(id, { limit: 3, windowSeconds: 60 });
    const second = await rateLimit(id, { limit: 3, windowSeconds: 60 });

    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(2);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(1);
  });

  it("blocks requests past the limit", async () => {
    const id = `test-block-${Date.now()}`;
    await rateLimit(id, { limit: 2, windowSeconds: 60 });
    await rateLimit(id, { limit: 2, windowSeconds: 60 });
    const third = await rateLimit(id, { limit: 2, windowSeconds: 60 });

    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it("scopes by identifier", async () => {
    const idA = `test-scope-a-${Date.now()}`;
    const idB = `test-scope-b-${Date.now()}`;

    await rateLimit(idA, { limit: 1, windowSeconds: 60 });
    const blockedA = await rateLimit(idA, { limit: 1, windowSeconds: 60 });
    const allowedB = await rateLimit(idB, { limit: 1, windowSeconds: 60 });

    expect(blockedA.allowed).toBe(false);
    expect(allowedB.allowed).toBe(true);
  });
});

describe("getClientIp", () => {
  it("uses the first value from x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(getClientIp(headers)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    const headers = new Headers({ "x-real-ip": "10.0.0.1" });
    expect(getClientIp(headers)).toBe("10.0.0.1");
  });

  it("returns 'unknown' when no IP headers are present", () => {
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});
