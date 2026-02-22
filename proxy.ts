// -----------------------------------------------------------------------------
// @file: proxy.ts
// @purpose: Auth gateway — redirect unauthenticated users from protected routes.
//           Dual mode: demo cookie (DEMO_MODE=true) or BetterAuth session cookie.
// @version: v1.2.0
// @status: active
// @lastUpdate: 2026-02-22
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

const isDemoMode = process.env.DEMO_MODE === "true";

// Routes that do NOT require authentication
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/reset-password",
  "/onboarding",
  "/invite", // covers /invite/[token]
  "/api/auth", // BetterAuth catch-all (sign-up, sign-in, etc.)
  "/api/billing/webhook",
  "/api/invite",
  "/api/session", // session check itself must be accessible
];

// Debug routes are only accessible in demo mode
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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Block debug routes in production (non-demo) mode
  if (!isDemoMode && isDemoOnlyPath(pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Demo-only paths are public when in demo mode
  if (isDemoMode && isDemoOnlyPath(pathname)) {
    return NextResponse.next();
  }

  // Public routes — no auth required
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Protected routes — check for auth cookie
  if (isDemoMode) {
    // Demo mode: check bb-demo-user cookie
    const demoCookie = request.cookies.get("bb-demo-user")?.value;
    if (!demoCookie) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  } else {
    // BetterAuth mode: check session cookie presence (no DB call)
    const sessionCookie = request.cookies.get("better-auth.session_token")?.value;
    if (!sessionCookie) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // Cookie exists — allow through
  // Fine-grained role checks remain in each API route via getCurrentUserOrThrow()
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder assets (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
