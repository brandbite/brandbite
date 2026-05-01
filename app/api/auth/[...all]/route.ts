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
/**
 * Bound how long we'll wait for BetterAuth's POST pipeline before
 * giving up. Vercel kills serverless functions at 10s on Hobby (60s on
 * Pro); 8s here keeps us under either ceiling so we can return a
 * structured error to the client instead of an empty 500 from the
 * platform timeout.
 *
 * If this fires it means something downstream (DB write, email send,
 * BetterAuth internal) is hanging. The error message includes that
 * context so the /login UI can surface it and the operator can see
 * what's stuck.
 */
const AUTH_HANDLER_TIMEOUT_MS = 8_000;

export async function POST(req: NextRequest) {
  // Snapshot the path early — a hung handler means we won't get to
  // read req.url after the timeout fires, so capture it now.
  const pathname = new URL(req.url).pathname;
  const startedAt = Date.now();

  // Diagnostic: log request shape + key env presence on every auth POST
  // so when something breaks the function logs tell us what arrived and
  // whether the runtime is configured. Logged once per request — cheap
  // and high-signal for "why is sign-up returning empty 500".
  const ct = req.headers.get("content-type") ?? "";
  const cl = req.headers.get("content-length") ?? "";
  const hasSecret = !!process.env.BETTER_AUTH_SECRET && process.env.BETTER_AUTH_SECRET.length >= 16;
  const hasResend = !!process.env.RESEND_API_KEY;
  const hasAppUrl = !!process.env.NEXT_PUBLIC_APP_URL;
  console.log(
    `[api/auth] POST ${pathname} ct=${ct} cl=${cl} secret=${hasSecret} resend=${hasResend} appUrl=${hasAppUrl}`,
  );

  // Hard-stop if BETTER_AUTH_SECRET is missing — every sign-up signs an
  // email-verification token via HMAC over this secret (better-auth
  // sign-up.mjs `createEmailVerificationToken`). Without it the throw
  // happens deep inside BetterAuth's pipeline in a way the platform
  // sometimes turns into an empty 500 instead of a structured error.
  // Surface a clear message instead.
  if (!hasSecret) {
    console.error("[api/auth] BETTER_AUTH_SECRET missing or too short");
    return NextResponse.json(
      {
        error: "Auth is misconfigured (missing secret). Contact support.",
        message: "Auth is misconfigured (missing secret). Contact support.",
      },
      { status: 500 },
    );
  }

  try {
    const limited = await gate(req);
    if (limited) return limited;

    const result = await Promise.race([
      baseHandlers.POST(req),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `Auth handler timed out after ${AUTH_HANDLER_TIMEOUT_MS}ms (path=${pathname})`,
              ),
            ),
          AUTH_HANDLER_TIMEOUT_MS,
        ),
      ),
    ]);

    // BetterAuth itself sometimes RETURNS (rather than throws) a
    // Response with status >= 500 and an empty body when its internal
    // pipeline errors in a path that doesn't get formatted. Our
    // try/catch only fires on throws, so an empty-body 500 would pass
    // through unchanged and the /login UI surfaces "Sign up failed."
    // with no detail. Inspect the response and re-shape it into a
    // structured JSON body so the client sees a real message and we
    // get a log line we can correlate with Vercel function logs.
    if (result instanceof Response && result.status >= 500) {
      let bodyText = "";
      try {
        bodyText = await result.clone().text();
      } catch {
        bodyText = "<unreadable>";
      }
      const elapsed = Date.now() - startedAt;
      console.error(
        `[api/auth] BetterAuth returned ${result.status} after ${elapsed}ms (path=${pathname}) body-preview=${JSON.stringify(bodyText).slice(0, 500)}`,
      );
      if (!bodyText.trim()) {
        return NextResponse.json(
          {
            error: `Auth pipeline returned empty ${result.status} (path=${pathname}, elapsed=${elapsed}ms). Vercel function logs hold the upstream error.`,
            message: "Sign-in service hit an internal error. Please try again in a moment.",
          },
          { status: result.status },
        );
      }
    }

    return result;
  } catch (err) {
    const elapsed = Date.now() - startedAt;
    console.error(`[api/auth] POST handler crashed after ${elapsed}ms`, {
      pathname,
      error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    });
    // Expose the underlying error message in non-production OR when
    // ALLOW_DEMO_IN_PROD=true (demo deploys want diagnostics over
    // mystery). Real production without that flag returns a generic
    // message so we don't leak internals to the network.
    const showReal =
      process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO_IN_PROD === "true";
    const message =
      showReal && err instanceof Error
        ? `Auth handler crashed: ${err.message}`
        : "Sign-in service is temporarily unavailable. Please try again in a moment.";
    return NextResponse.json({ error: message, message }, { status: 500 });
  }
}

export const GET = baseHandlers.GET;
