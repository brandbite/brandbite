// -----------------------------------------------------------------------------
// @file: lib/__tests__/middleware-paths.test.ts
// @purpose: Unit tests for proxy path matching logic
// -----------------------------------------------------------------------------

import { describe, it, expect } from "vitest";

// Recreate the path matching logic from proxy.ts to test it in isolation
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
