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
  "/how-it-works",
  "/pricing",
  "/showcase", // marketing pages
  "/blog", // marketing pages
  "/faq", // marketing pages
  "/about", // marketing pages
  "/contact", // marketing pages
  "/documentation", // marketing pages
  "/news", // marketing pages
  "/privacy", // legal — must be readable without auth (GDPR, Stripe)
  "/terms", // legal — must be readable without auth (Stripe checkout)
  "/cookies", // legal — cookie policy must be readable from the banner
  "/accessibility", // legal — WCAG 2.2 AA statement
  "/api/auth", // BetterAuth catch-all (sign-up, sign-in, etc.)
  "/api/billing/webhook",
  "/api/invite",
  "/api/session", // session check itself must be accessible
  "/api/showcase", // public CMS read
  "/api/blog", // public CMS read
  "/api/pages", // public CMS page read
  "/api/news", // public CMS news read
  "/api/docs", // public docs read
  // Stripe-authoritative pricing surface read by the public landing
  // page + /pricing. No sensitive data, just plan name + priceCents +
  // monthlyTokens that any visitor would see by rendering the page.
  "/api/plans",
  // Central FAQ store read by /faq, /customer/faq, /creative/faq, and
  // the landing-page FAQ block. Returns active questions only; admin
  // mutations live behind /api/admin/faq.
  "/api/faq",
  // Block-driven landing-page content (hero, how-it-works, FAQ block).
  // Read by app/page.tsx so admin edits at /admin/landing actually
  // surface for visitors. Without this entry the proxy 307's the
  // request to /login and the landing page silently falls back to
  // the hardcoded defaults — the bug that made the FAQ CTA edit
  // appear not to take effect on demo.
  "/api/page-blocks",
  "/api/health", // uptime monitors (BetterStack / Upptime / Vercel); route returns 200 or 503
  // Vercel Cron invocations. Each cron route is defence-in-depth with a
  // CRON_SECRET Bearer check; the proxy only needs to let the request
  // reach the handler. Auth-gating here silently breaks every scheduled
  // job because Vercel Cron does not send a BetterAuth session cookie.
  "/api/cron",
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
