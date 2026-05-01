// -----------------------------------------------------------------------------
// @file: app/api/auth/[...all]/route.ts
// @purpose: BetterAuth catch-all API handler for sign-up, sign-in, sign-out,
//           magic link, session, etc. All endpoints live under /api/auth/*.
//
//           Wrapped with a two-layer rate limiter:
//             1. Per-IP bucket — blunts credential-stuffing from a single
//                attacker. (Already in place since #124.)
//             2. Per-email bucket — prevents an attacker rotating IPs from
//                spamming password-reset / verification emails to a single
//                victim's inbox (inbox DoS + Resend budget burn) and
//                softens account-level brute-force on sign-in.
//
//           Upstash-backed when configured, in-memory fallback otherwise.
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

/** Paths where we also apply a per-email bucket. Attackers rotating IPs
 *  can still burn a victim's mailbox + our Resend budget, and can still
 *  brute-force one account across many IPs. The per-email bucket stops
 *  both. Keys are substrings matched against the pathname. */
const EMAIL_BUCKET_PATHS = [
  "/sign-in",
  "/forget-password",
  "/forgot-password",
  "/send-verification-email",
  "/magic-link",
];

function isSensitive(pathname: string): boolean {
  return SENSITIVE_PATTERNS.some((re) => re.test(pathname));
}

function needsEmailBucket(pathname: string): boolean {
  return EMAIL_BUCKET_PATHS.some((p) => pathname.includes(p));
}

const baseHandlers = toNextJsHandler(auth);

// ---------------------------------------------------------------------------
// Per-email bucket helper
//
// We peek at the JSON body via req.clone() so we can still pass the
// unconsumed original request to BetterAuth downstream. BetterAuth's
// sign-in / forget-password / send-verification-email / magic-link
// bodies all use `email` as the field name.
// ---------------------------------------------------------------------------

async function extractEmail(req: NextRequest): Promise<string | null> {
  try {
    const cloned = req.clone();
    const contentType = cloned.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) return null;
    const body = (await cloned.json().catch(() => null)) as { email?: unknown } | null;
    if (!body) return null;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;
    if (!email) return null;
    // Reject obviously non-email strings so we don't bucket-bomb a key we
    // can't meaningfully throttle on. Real validation happens downstream.
    if (email.length > 320 || !email.includes("@")) return null;
    return email;
  } catch {
    return null;
  }
}

/** Per-request rate gate. Returns null when the request is allowed, or a
 *  429 NextResponse when limited. Only POSTs are gated — GETs (session
 *  reads, callbacks) are too frequent and not attack-surface. */
async function gate(req: NextRequest): Promise<NextResponse | null> {
  const ip = getClientIp(req.headers);
  const url = new URL(req.url);
  const pathname = url.pathname;
  const sensitive = isSensitive(pathname);

  // Layer 1 — per-IP bucket.
  const ipResult = await rateLimit(
    `auth:${sensitive ? "sensitive" : "general"}:${ip}`,
    sensitive
      ? { limit: 10, windowSeconds: 60 } //  ~1 sustained attempt / 6s per IP
      : { limit: 60, windowSeconds: 60 },
  );
  if (!ipResult.allowed) {
    const retryAfter = Math.max(
      1,
      Math.ceil((new Date(ipResult.resetAt).getTime() - Date.now()) / 1000),
    );
    // `message` is the field BetterAuth's authClient reads off error
    // responses (`signInError.message`), which is how the text surfaces
    // in the UI. We also keep `error` for any non-BetterAuth callers /
    // direct fetch consumers that happen to look for it.
    const body = {
      message:
        "Too many attempts from this IP. Wait a minute and try again; if this keeps happening, reach out at support@brandbite.studio.",
    };
    return NextResponse.json(
      { ...body, error: body.message },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  // Layer 2 — per-email bucket (only on paths that take an email). Quiet
  // failure when we can't parse an email — downstream handler will 400
  // with a cleaner error.
  if (needsEmailBucket(pathname)) {
    const email = await extractEmail(req);
    if (email) {
      // 5 attempts per 15 min is aggressive enough to stop an inbox-DoS
      // and brute-force across IPs, and loose enough to tolerate an
      // honest user mistyping their password a few times.
      const emailResult = await rateLimit(`auth:email:${email}`, {
        limit: 5,
        windowSeconds: 15 * 60,
      });
      if (!emailResult.allowed) {
        const retryAfter = Math.max(
          1,
          Math.ceil((new Date(emailResult.resetAt).getTime() - Date.now()) / 1000),
        );
        const body = {
          message:
            "Too many attempts for this email. Wait 15 minutes and try again. If you didn't request this, you can ignore it.",
        };
        return NextResponse.json(
          { ...body, error: body.message },
          { status: 429, headers: { "Retry-After": String(retryAfter) } },
        );
      }
    }
  }

  return null;
}

/**
 * Crash boundary around the BetterAuth POST handler. BetterAuth itself
 * catches its own errors and returns structured JSON, but anything
 * upstream of it (this gate, an env-config issue, a Prisma adapter
 * crash, an email-template render error) bubbles past as an unhandled
 * exception and Next.js returns a 500 with an empty body. Empty 500s
 * surface in the /login UI as the unhelpful "Sign up failed." with no
 * detail.
 *
 * Wrapping here means every failure mode gets a JSON body the client can
 * surface. In non-production we include the error message so the
 * /login page can actually show the cause; in production we keep the
 * message generic to avoid leaking internals to the network.
 */
export async function POST(req: NextRequest) {
  try {
    const limited = await gate(req);
    if (limited) return limited;
    return await baseHandlers.POST(req);
  } catch (err) {
    console.error("[api/auth] POST handler crashed", err);
    const message =
      process.env.NODE_ENV !== "production" && err instanceof Error
        ? `Auth handler crashed: ${err.message}`
        : "Sign-in service is temporarily unavailable. Please try again in a moment.";
    return NextResponse.json({ error: message, message }, { status: 500 });
  }
}

export const GET = baseHandlers.GET;
