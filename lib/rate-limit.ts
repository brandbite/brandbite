// -----------------------------------------------------------------------------
// @file: lib/rate-limit.ts
// @purpose: In-memory sliding-window rate limiter for API routes
// -----------------------------------------------------------------------------

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 60 seconds
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

type RateLimitConfig = {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

/**
 * In-memory sliding-window rate limiter.
 *
 * Use `identifier` to scope limits (e.g. IP address, user ID, route name).
 * Suitable for single-instance or Vercel serverless deployments where each
 * cold start gets a fresh Map. For aggressive abuse prevention, upgrade to
 * Vercel KV or Upstash Redis.
 */
export function rateLimit(identifier: string, config: RateLimitConfig): RateLimitResult {
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

/**
 * Get client IP from Next.js request headers.
 * Vercel sets x-forwarded-for automatically.
 */
export function getClientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headers.get("x-real-ip") ?? "unknown"
  );
}
