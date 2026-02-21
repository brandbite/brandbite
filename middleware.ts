// -----------------------------------------------------------------------------
// @file: middleware.ts
// @purpose: Auth gateway — redirect unauthenticated users from protected routes
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

// Routes that do NOT require authentication
const PUBLIC_PATHS = [
  "/",
  "/onboarding",
  "/invite", // covers /invite/[token]
  "/board", // public board view
  "/api/billing/webhook",
  "/api/debug", // demo-only — remove when BetterAuth is live
  "/api/invite",
  "/api/board", // public board API
  "/api/session", // session check itself must be accessible
];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;

  return PUBLIC_PATHS.some((pub) => {
    if (pub === "/") return false;
    return pathname === pub || pathname.startsWith(pub + "/");
  });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes — no auth required
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Protected routes — check for demo auth cookie
  // When BetterAuth is active, replace with session token validation
  const demoCookie = request.cookies.get("bb-demo-user")?.value;
  if (!demoCookie) {
    const loginUrl = new URL("/", request.url);
    return NextResponse.redirect(loginUrl);
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
