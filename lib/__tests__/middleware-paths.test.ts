// -----------------------------------------------------------------------------
// @file: lib/__tests__/middleware-paths.test.ts
// @purpose: Unit tests for proxy path matching logic
// -----------------------------------------------------------------------------

import { describe, it, expect } from "vitest";

// Recreate the path matching logic from proxy.ts to test it in isolation.
// Keep this list in sync with PUBLIC_PATHS in proxy.ts — the tests below
// explicitly cover:
//   - Legal pages: unauthenticated users read them from cookie banners
//     and sign-up flows (GDPR, Stripe checkout).
//   - /api/health: external uptime monitors need a 200/503 response
//     without a session cookie.
//   - /api/cron: Vercel Cron invocations have no session cookie; the
//     route handlers enforce their own CRON_SECRET Bearer auth.
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/reset-password",
  "/onboarding",
  "/invite",
  "/api/auth",
  "/api/billing/webhook",
  "/api/invite",
  "/api/session",
  "/api/health",
  "/api/cron",
  "/privacy",
  "/terms",
  "/cookies",
  "/accessibility",
];

const DEMO_ONLY_PATHS = ["/api/debug", "/debug"];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PATHS.some((pub) => {
    if (pub === "/") return false;
    return pathname === pub || pathname.startsWith(pub + "/");
  });
}

function isDemoOnlyPath(pathname: string): boolean {
  return DEMO_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

// ---------------------------------------------------------------------------
// isPublicPath
// ---------------------------------------------------------------------------

describe("isPublicPath", () => {
  it("marks root as public", () => {
    expect(isPublicPath("/")).toBe(true);
  });

  it("marks /login as public", () => {
    expect(isPublicPath("/login")).toBe(true);
  });

  it("marks /reset-password as public", () => {
    expect(isPublicPath("/reset-password")).toBe(true);
  });

  it("marks /onboarding as public", () => {
    expect(isPublicPath("/onboarding")).toBe(true);
  });

  it("marks /invite/abc123 as public", () => {
    expect(isPublicPath("/invite/abc123")).toBe(true);
  });

  it("marks /api/auth/signin as public", () => {
    expect(isPublicPath("/api/auth/signin")).toBe(true);
  });

  it("marks /api/session as public", () => {
    expect(isPublicPath("/api/session")).toBe(true);
  });

  it("marks /admin as protected", () => {
    expect(isPublicPath("/admin")).toBe(false);
  });

  it("marks /admin/users as protected", () => {
    expect(isPublicPath("/admin/users")).toBe(false);
  });

  it("marks /customer/board as protected", () => {
    expect(isPublicPath("/customer/board")).toBe(false);
  });

  it("marks /creative/tickets as protected", () => {
    expect(isPublicPath("/creative/tickets")).toBe(false);
  });

  it("marks /api/admin/users as protected", () => {
    expect(isPublicPath("/api/admin/users")).toBe(false);
  });

  it("marks /api/customer/tickets as protected", () => {
    expect(isPublicPath("/api/customer/tickets")).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Legal pages — must be public. A signed-out visitor must be able to read
  // Privacy, Terms, Cookies, and the Accessibility statement (GDPR, Stripe
  // checkout, cookie banner link targets, WCAG 2.2 AA statement). If any of
  // these drop off the allow-list, users hit a login redirect instead of the
  // policy text — a legal and accessibility-compliance failure.
  // -------------------------------------------------------------------------
  for (const legalPath of ["/privacy", "/terms", "/cookies", "/accessibility"]) {
    it(`marks ${legalPath} as public`, () => {
      expect(isPublicPath(legalPath)).toBe(true);
    });
  }

  // -------------------------------------------------------------------------
  // Infrastructure routes — auth-gating these silently breaks production
  // without surfacing an error anywhere.
  //
  //   /api/health: external uptime monitors (BetterStack / Upptime) hit it
  //     with no cookie. A 307-to-login is not a 200 or 503 and therefore not
  //     a useful health signal.
  //
  //   /api/cron/*: Vercel Cron invokes these on a schedule with no session
  //     cookie. Each cron route has its own CRON_SECRET Bearer check, so the
  //     proxy only needs to let the request through. Gating here means the
  //     scheduled jobs never run and Vercel logs the 307 as "success".
  // -------------------------------------------------------------------------
  it("marks /api/health as public", () => {
    expect(isPublicPath("/api/health")).toBe(true);
  });

  it("marks /api/cron/process-payouts as public", () => {
    expect(isPublicPath("/api/cron/process-payouts")).toBe(true);
  });

  it("marks any future /api/cron/* route as public", () => {
    expect(isPublicPath("/api/cron/hypothetical-future-job")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isDemoOnlyPath
// ---------------------------------------------------------------------------

describe("isDemoOnlyPath", () => {
  it("marks /debug as demo-only", () => {
    expect(isDemoOnlyPath("/debug")).toBe(true);
  });

  it("marks /debug/demo-user as demo-only", () => {
    expect(isDemoOnlyPath("/debug/demo-user")).toBe(true);
  });

  it("marks /api/debug as demo-only", () => {
    expect(isDemoOnlyPath("/api/debug")).toBe(true);
  });

  it("marks /api/debug/set-demo-user as demo-only", () => {
    expect(isDemoOnlyPath("/api/debug/set-demo-user")).toBe(true);
  });

  it("does not mark /admin as demo-only", () => {
    expect(isDemoOnlyPath("/admin")).toBe(false);
  });

  it("does not mark / as demo-only", () => {
    expect(isDemoOnlyPath("/")).toBe(false);
  });

  it("does not mark /login as demo-only", () => {
    expect(isDemoOnlyPath("/login")).toBe(false);
  });
});
