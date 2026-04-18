// -----------------------------------------------------------------------------
// @file: lib/rate-limit.ts
// @purpose: Sliding-window rate limiter — Upstash Redis when configured,
//           in-memory fallback otherwise. In-memory mode is per-instance and
//           must not be relied on for abuse prevention in production.
// -----------------------------------------------------------------------------

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitConfig = {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

// ---------------------------------------------------------------------------
// Upstash backend (enabled when both env vars are set)
// ---------------------------------------------------------------------------

const upstashRedis = (() => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
})();

const upstashLimiterCache = new Map<string, Ratelimit>();

function getUpstashLimiter(config: RateLimitConfig): Ratelimit | null {
  if (!upstashRedis) return null;
  const cacheKey = `${config.limit}:${config.windowSeconds}`;
  let limiter = upstashLimiterCache.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: upstashRedis,
      limiter: Ratelimit.slidingWindow(config.limit, `${config.windowSeconds} s`),
      prefix: "bb:rl",
      analytics: false,
    });
    upstashLimiterCache.set(cacheKey, limiter);
  }
  return limiter;
}

// ---------------------------------------------------------------------------
// In-memory fallback — single-instance only
// ---------------------------------------------------------------------------

const store = new Map<string, RateLimitEntry>();

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) {
        store.delete(key);
      }
    }
  }, 60_000);
}

function rateLimitInMemory(identifier: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  const existing = store.get(identifier);

  if (!existing || now > existing.resetAt) {
    const entry: RateLimitEntry = { count: 1, resetAt: now + windowMs };
    store.set(identifier, entry);
    return { allowed: true, remaining: config.limit - 1, resetAt: entry.resetAt };
  }

  existing.count += 1;

  if (existing.count > config.limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  return {
    allowed: true,
    remaining: config.limit - existing.count,
    resetAt: existing.resetAt,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sliding-window rate limiter.
 *
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 * are set — correct across multiple Vercel instances. Otherwise falls back to
 * an in-memory Map, which is single-instance and should only be used in
 * development.
 *
 * `identifier` scopes the counter (e.g. IP address, user ID, route name).
 */
export async function rateLimit(
  identifier: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const upstash = getUpstashLimiter(config);
  if (upstash) {
    const result = await upstash.limit(identifier);
    return {
      allowed: result.success,
      remaining: Math.max(0, result.remaining),
      resetAt: result.reset,
    };
  }
  return rateLimitInMemory(identifier, config);
}

/**
 * Get client IP from Next.js request headers.
 * Vercel sets x-forwarded-for automatically.
 */
export function getClientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headers.get("x-real-ip") ?? "unknown"
  );
}
