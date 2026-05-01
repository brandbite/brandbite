// -----------------------------------------------------------------------------
// @file: tests/integration/auth-flow.test.ts
// @purpose: End-to-end regression test for the BetterAuth sign-up + sign-in
//           flow against a real Prisma database.
//
//           Why this exists: PR #210 fixed a regression where BetterAuth's
//           Prisma adapter couldn't find our `authUser` / `authSession` /
//           `authAccount` / `authVerification` models because the model-name
//           overrides were missing. The bug went undetected through 13+ PRs
//           because no test exercised the live BetterAuth sign-up path —
//           existing tests seed `UserAccount` + `AuthSession` rows directly
//           via Prisma instead of going through `/api/auth/sign-up/email`.
//           That left us with empty 500s shipping to the demo deploy and a
//           half-day diagnosis chase.
//
//           This test calls the actual route handler in
//           `app/api/auth/[...all]/route.ts` so every layer is exercised:
//           the rate-limit gate, the route's crash boundary, BetterAuth's
//           pipeline, the Prisma adapter, the email-sender hooks (which
//           silently no-op without `RESEND_API_KEY`). If any of those
//           regress in a way that breaks sign-up end-to-end, this test
//           fails loudly in CI before it can ship to demo.
// -----------------------------------------------------------------------------

import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

import { resetDatabase } from "./helpers/db";

// Lazy import the route handler so the integration setup's `db push` runs
// before the BetterAuth module loads its Prisma client. Loading the route
// at top level would race with the schema reset.
type RouteModule = typeof import("@/app/api/auth/[...all]/route");
let route: RouteModule;

beforeAll(async () => {
  // BetterAuth's `betterAuth()` factory throws on init if `secret` is
  // undefined. The unit-test CI job sets BETTER_AUTH_SECRET; the
  // integration job historically did not (sign-up wasn't exercised).
  // Default it here so the test runs whether or not CI sets it.
  if (!process.env.BETTER_AUTH_SECRET) {
    process.env.BETTER_AUTH_SECRET = "test-only-secret-32-chars-minimum-aaaa";
  }
  // Demo mode would short-circuit `getCurrentUser` to the persona cookie
  // path; for a sign-up test we want the BetterAuth code path. Make sure
  // it's off.
  delete process.env.DEMO_MODE;
  delete process.env.ALLOW_DEMO_IN_PROD;

  route = await import("@/app/api/auth/[...all]/route");
});

beforeEach(async () => {
  await resetDatabase();
});

// Each test gets a fresh email + IP so the per-IP / per-email rate-limit
// buckets in the route gate don't trip. The gate stores buckets in an
// in-memory map (Upstash isn't configured for tests), and that map is
// process-global, so without rotation a long suite would eventually 429.
let testCounter = 0;
function nextEmail(): string {
  testCounter += 1;
  return `auth-test-${Date.now()}-${testCounter}@example.test`;
}
function nextIp(): string {
  return `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

afterEach(() => {
  // Reset BetterAuth's in-memory rate limiter between tests so a single
  // failing test can't bleed into the next one's quota.
  // (BetterAuth's default storage is "memory"; no real reset API, but
  // resetDatabase + fresh emails keeps both layers below their limits.)
});

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

/** Construct a NextRequest the route handler accepts. Each request gets a
 *  unique x-forwarded-for so the per-IP rate-limit bucket is isolated. */
function makeRequest(
  pathname: string,
  init: { method: "GET" | "POST"; body?: unknown; cookie?: string },
): NextRequest {
  const headers = new Headers({
    "content-type": "application/json",
    "x-forwarded-for": nextIp(),
  });
  if (init.cookie) headers.set("cookie", init.cookie);

  return new NextRequest(`http://test.local${pathname}`, {
    method: init.method,
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

/** Pull all `Set-Cookie` headers off a Response and reduce them to a single
 *  `cookie:` header value the next request can replay. Each cookie's first
 *  segment (`name=value`) is what gets sent back. */
function extractCookieHeader(res: Response): string {
  const all = res.headers.getSetCookie();
  return all.map((c) => c.split(";")[0]).join("; ");
}

/* ---------------------------------------------------------------------------
 * Tests
 * ------------------------------------------------------------------------- */

describe("auth flow (integration) — sign-up → verify → sign-in → session → sign-out", () => {
  it("sign-up writes a user row through the Prisma authUser model", async () => {
    const email = nextEmail();
    const req = makeRequest("/api/auth/sign-up/email", {
      method: "POST",
      body: { email, password: "TestPass1234!", name: "Sign Up User" },
    });

    const res = await route.POST(req);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      user: { id: string; email: string; emailVerified: boolean };
    };
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe(email);
    expect(body.user.emailVerified).toBe(false);

    // Confirm the row landed via the right Prisma model. If the model-name
    // mapping regresses, this lookup fails.
    const dbRow = await prisma.authUser.findUnique({ where: { email } });
    expect(dbRow).not.toBeNull();
    expect(dbRow?.id).toBe(body.user.id);
  });

  it("sign-in fails for unverified user (requireEmailVerification=true)", async () => {
    const email = nextEmail();
    const password = "TestPass1234!";

    // Sign up
    const signUpRes = await route.POST(
      makeRequest("/api/auth/sign-up/email", {
        method: "POST",
        body: { email, password, name: "Unverified" },
      }),
    );
    expect(signUpRes.status).toBe(200);

    // Try to sign in without verifying — BetterAuth rejects.
    const signInRes = await route.POST(
      makeRequest("/api/auth/sign-in/email", {
        method: "POST",
        body: { email, password },
      }),
    );
    // BetterAuth returns either 401 or 403 with an unverified-email error;
    // either is acceptable. The point is sign-in does NOT succeed.
    expect(signInRes.status).not.toBe(200);
    expect(signInRes.status).toBeGreaterThanOrEqual(400);
  });

  it("verified user can sign in, hit get-session, and sign out", async () => {
    const email = nextEmail();
    const password = "TestPass1234!";

    // 1) Sign up.
    const signUpRes = await route.POST(
      makeRequest("/api/auth/sign-up/email", {
        method: "POST",
        body: { email, password, name: "Full Flow" },
      }),
    );
    expect(signUpRes.status).toBe(200);

    // 2) Manually mark email as verified — skipping the email-link click
    //    that's not exercisable in tests. Mirrors what BetterAuth does
    //    when the user clicks the link in production.
    await prisma.authUser.update({
      where: { email },
      data: { emailVerified: true },
    });

    // 3) Sign in.
    const signInRes = await route.POST(
      makeRequest("/api/auth/sign-in/email", {
        method: "POST",
        body: { email, password },
      }),
    );
    expect(signInRes.status).toBe(200);

    // BetterAuth sets a session cookie via Set-Cookie. Without it the
    // session-read step below would fail.
    const cookie = extractCookieHeader(signInRes);
    expect(cookie).toMatch(/better-auth\.session_token=/);

    // 4) GET /api/auth/get-session with the cookie returns the user.
    const sessionRes = await route.GET(
      makeRequest("/api/auth/get-session", { method: "GET", cookie }),
    );
    expect(sessionRes.status).toBe(200);
    const sessionBody = (await sessionRes.json()) as {
      user?: { email: string };
      session?: { id: string };
    } | null;
    expect(sessionBody?.user?.email).toBe(email);
    expect(sessionBody?.session?.id).toBeDefined();

    // 5) Sign out — the session row should be deleted from the DB.
    const signOutRes = await route.POST(
      makeRequest("/api/auth/sign-out", {
        method: "POST",
        body: {},
        cookie,
      }),
    );
    expect(signOutRes.status).toBe(200);

    // After sign-out, get-session with the same cookie returns no user.
    const afterSignOutRes = await route.GET(
      makeRequest("/api/auth/get-session", { method: "GET", cookie }),
    );
    const afterSignOutBody = (await afterSignOutRes.json()) as {
      user?: unknown;
      session?: unknown;
    } | null;
    expect(afterSignOutBody?.user).toBeFalsy();
    expect(afterSignOutBody?.session).toBeFalsy();
  });

  it("rejects a duplicate email on sign-up", async () => {
    const email = nextEmail();
    const password = "TestPass1234!";

    const first = await route.POST(
      makeRequest("/api/auth/sign-up/email", {
        method: "POST",
        body: { email, password, name: "First" },
      }),
    );
    expect(first.status).toBe(200);

    const second = await route.POST(
      makeRequest("/api/auth/sign-up/email", {
        method: "POST",
        body: { email, password, name: "Second" },
      }),
    );
    expect(second.status).not.toBe(200);
    expect(second.status).toBeGreaterThanOrEqual(400);
  });

  it("returns 400 when password fails the policy (server-side enforcement)", async () => {
    const email = nextEmail();
    const res = await route.POST(
      makeRequest("/api/auth/sign-up/email", {
        method: "POST",
        // Lowercase only, too short — fails our before-hook policy and
        // BetterAuth's minLength.
        body: { email, password: "short", name: "Weak" },
      }),
    );
    expect(res.status).toBe(400);
  });
});
