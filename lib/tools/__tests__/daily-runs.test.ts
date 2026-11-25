// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { redis } = vi.hoisted(() => ({ redis: { current: null as unknown } }));
vi.mock("@/lib/rate-limit", () => ({ getUpstashRedis: () => redis.current }));

import { clearRunsInMemory, holdRun, returnRun } from "../daily-runs";

const DAY = { limit: 3, windowSeconds: 86400 };

/** A stand-in for the few Redis commands the counter uses. */
function fakeRedis() {
  const values = new Map<string, number>();
  const ttls = new Map<string, number>();
  return {
    values,
    ttls,
    incr: vi.fn(async (key: string) => {
      values.set(key, (values.get(key) ?? 0) + 1);
      return values.get(key)!;
    }),
    decr: vi.fn(async (key: string) => {
      values.set(key, (values.get(key) ?? 0) - 1);
      return values.get(key)!;
    }),
    expire: vi.fn(async (key: string, seconds: number) => void ttls.set(key, seconds)),
    ttl: vi.fn(async (key: string) => ttls.get(key) ?? -1),
    del: vi.fn(async (key: string) => void values.delete(key)),
  };
}

beforeEach(() => {
  clearRunsInMemory();
  redis.current = null;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.useRealTimers());

for (const store of ["memory", "redis"] as const) {
  describe(`a day's runs, counted in ${store}`, () => {
    beforeEach(() => {
      if (store === "redis") redis.current = fakeRedis();
    });

    it("allows up to the limit, then refuses", async () => {
      expect(await holdRun("c1", DAY)).toMatchObject({ allowed: true, remaining: 2 });
      expect(await holdRun("c1", DAY)).toMatchObject({ allowed: true, remaining: 1 });
      expect(await holdRun("c1", DAY)).toMatchObject({ allowed: true, remaining: 0 });
      expect(await holdRun("c1", DAY)).toMatchObject({ allowed: false, remaining: 0 });
      // A refusal doesn't use anything up, however often it is tried.
      expect(await holdRun("c1", DAY)).toMatchObject({ allowed: false, remaining: 0 });
      expect(await returnRun("c1", DAY)).toBe(1);
      // Another company has its own count.
      expect(await holdRun("c2", DAY)).toMatchObject({ allowed: true, remaining: 2 });
    });

    it("gives a failed run back", async () => {
      await holdRun("c1", DAY);
      await holdRun("c1", DAY);
      expect(await returnRun("c1", DAY)).toBe(2);
      expect(await holdRun("c1", DAY)).toMatchObject({ allowed: true, remaining: 1 });
      // Ten failures in a row leave the day's runs untouched.
      for (let i = 0; i < 10; i++) {
        await holdRun("c3", DAY);
        await returnRun("c3", DAY);
      }
      expect(await holdRun("c3", DAY)).toMatchObject({ allowed: true, remaining: 2 });
    });

    it("never gives back more than the limit", async () => {
      expect(await returnRun("never-used", DAY)).toBe(3);
      expect(await holdRun("never-used", DAY)).toMatchObject({ allowed: true, remaining: 2 });
    });
  });
}

describe("a day's runs", () => {
  it("starts again when the day is over", async () => {
    vi.useFakeTimers();
    for (let i = 0; i < 3; i++) await holdRun("c1", DAY);
    const refused = await holdRun("c1", DAY);
    expect(refused.allowed).toBe(false);
    vi.setSystemTime(refused.resetAt + 1);
    expect(await holdRun("c1", DAY)).toMatchObject({ allowed: true, remaining: 2 });
  });

  it("gives the Redis counter an end, and repairs one that has none", async () => {
    const fake = fakeRedis();
    redis.current = fake;
    const first = await holdRun("c1", DAY);
    expect(fake.expire).toHaveBeenCalledWith("bb:runs:c1", 86400);
    expect(first.resetAt).toBeGreaterThan(Date.now() + 86_000_000);
    fake.ttls.delete("bb:runs:c1");
    await holdRun("c1", DAY);
    expect(fake.ttls.get("bb:runs:c1")).toBe(86400);
  });

  it("keeps working in memory when Redis is down", async () => {
    redis.current = {
      incr: vi.fn(async () => {
        throw new Error("down");
      }),
      decr: vi.fn(async () => {
        throw new Error("down");
      }),
    };
    expect(await holdRun("c1", DAY)).toMatchObject({ allowed: true, remaining: 2 });
    expect(await returnRun("c1", DAY)).toBeNull();
  });
});
