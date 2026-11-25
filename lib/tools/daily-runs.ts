// -----------------------------------------------------------------------------
// @file: lib/tools/daily-runs.ts
// @purpose: Counts a company's runs of a plan-included AI tool (AI resize,
//           Brand-voice copy) against its limit for a day. A run is held
//           before the model is called, so two people can't both take the
//           last one, and given back when the run fails: a failure is not
//           the customer's doing and doesn't cost them a run.
//
//           The day starts with the first run and lasts `windowSeconds`.
//           Counted in Upstash Redis when it is set up (required in
//           production, see instrumentation.ts), otherwise in this
//           process's memory, which is only good for development.
// -----------------------------------------------------------------------------

import { getUpstashRedis } from "@/lib/rate-limit";

export type DailyRunsConfig = { limit: number; windowSeconds: number };

export type HeldRun = {
  allowed: boolean;
  /** Runs left after this one; 0 when it was refused. */
  remaining: number;
  /** When the count starts again (ms since epoch). */
  resetAt: number;
};

const PREFIX = "bb:runs:";
const memory = new Map<string, { count: number; resetAt: number }>();

function memoryEntry(key: string, windowSeconds: number) {
  const now = Date.now();
  let entry = memory.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowSeconds * 1000 };
    memory.set(key, entry);
  }
  return entry;
}

function holdInMemory(key: string, config: DailyRunsConfig): HeldRun {
  const entry = memoryEntry(key, config.windowSeconds);
  if (entry.count >= config.limit) return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  entry.count += 1;
  return { allowed: true, remaining: config.limit - entry.count, resetAt: entry.resetAt };
}

/** Hold one run. Refused when the day's runs are used up. */
export async function holdRun(key: string, config: DailyRunsConfig): Promise<HeldRun> {
  const redis = getUpstashRedis();
  if (redis) {
    try {
      const name = PREFIX + key;
      const count = await redis.incr(name);
      if (count === 1) await redis.expire(name, config.windowSeconds);
      let ttl = await redis.ttl(name);
      // A counter left without an end (the expire call was lost) gets one now.
      if (ttl < 0) {
        await redis.expire(name, config.windowSeconds);
        ttl = config.windowSeconds;
      }
      const resetAt = Date.now() + ttl * 1000;
      if (count > config.limit) {
        await redis.decr(name);
        return { allowed: false, remaining: 0, resetAt };
      }
      return { allowed: true, remaining: config.limit - count, resetAt };
    } catch (error) {
      console.warn("[daily-runs] Upstash failed, counting in memory", error);
    }
  }
  return holdInMemory(key, config);
}

/**
 * Give back a run that was held but failed. Returns the runs left now, or
 * null when that couldn't be read (the caller then keeps its earlier number).
 */
export async function returnRun(key: string, config: DailyRunsConfig): Promise<number | null> {
  const redis = getUpstashRedis();
  if (redis) {
    try {
      const name = PREFIX + key;
      const count = await redis.decr(name);
      if (count < 0) {
        // The day ended between the hold and the return: nothing to give back.
        await redis.del(name);
        return config.limit;
      }
      return Math.max(0, config.limit - count);
    } catch (error) {
      console.warn("[daily-runs] Upstash failed while returning a run", error);
      return null;
    }
  }
  const entry = memory.get(key);
  if (!entry || Date.now() > entry.resetAt) return config.limit;
  entry.count = Math.max(0, entry.count - 1);
  return config.limit - entry.count;
}

/** For tests. */
export function clearRunsInMemory() {
  memory.clear();
}
