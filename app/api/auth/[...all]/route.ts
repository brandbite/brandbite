// -----------------------------------------------------------------------------
// @file: app/api/auth/[...all]/route.ts
// @purpose: BetterAuth catch-all API handler for sign-up, sign-in, sign-out,
//           magic link, session, etc. All endpoints live under /api/auth/*.
//
//           Wrapped with a per-IP rate limiter to blunt credential-stuffing
//           against sign-in / sign-up / password reset (Upstash when
//           configured, in-memory fallback when not).
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/better-auth";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

/** Auth endpoints that deserve tighter limits (write-style, brute-force
 *  targets). Everything else falls through to the broader bucket. */
const SENSITIVE_PATTERNS = [
  /\/sign-in(\/|$)/,
  /\/sign-up(\/|$)/,
  /\/forget-password(\/|$)/,
  /\/forgot-password(\/|$)/,
  /\/reset-password(\/|$)/,
  /\/send-verification-email(\/|$)/,
  /\/magic-link(\/|$)/,
];

function isSensitive(pathname: string): boolean {
  return SENSITIVE_PATTERNS.some((re) => re.test(pathname));
}

const baseHandlers = toNextJsHandler(auth);

/** Per-request rate gate. Returns null when the request is allowed, or a
 *  429 NextResponse when limited. Only POSTs are gated — GETs (session
 *  reads, callbacks) are too frequent and not attack-surface. */
async function gate(req: NextRequest): Promise<NextResponse | null> {
  const ip = getClientIp(req.headers);
  const url = new URL(req.url);
  const sensitive = isSensitive(url.pathname);

  const result = await rateLimit(
    `auth:${sensitive ? "sensitive" : "general"}:${ip}`,
    sensitive
      ? { limit: 10, windowSeconds: 60 } //  ~1 sustained attempt / 6s per IP
      : { limit: 60, windowSeconds: 60 },
  );

  if (!result.allowed) {
    const retryAfter = Math.max(
      1,
      Math.ceil((new Date(result.resetAt).getTime() - Date.now()) / 1000),
    );
    return NextResponse.json(
      {
        error:
          "Too many attempts from this IP. Wait a minute and try again; if this keeps happening, reach out at support@brandbite.studio.",
      },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }
  return null;
}

export async function POST(req: NextRequest) {
  const limited = await gate(req);
  if (limited) return limited;
  return baseHandlers.POST(req);
}

export const GET = baseHandlers.GET;
