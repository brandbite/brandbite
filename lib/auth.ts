// -----------------------------------------------------------------------------
// @file: lib/auth.ts
// @purpose: Auth integration boundary. Real BetterAuth sessions ALWAYS win;
//           the demo persona cookie is only consulted when no real session
//           exists and DEMO_MODE is on. Previously the order was reversed
//           and a stale persona cookie silently masked a freshly signed-in
//           user — the "Sign in to demo, still see Site Owner persona" bug.
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-05-01
// -----------------------------------------------------------------------------

import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "./roles";
import {
  getEmailForDemoPersona,
  isValidDemoPersona,
  type DemoPersonaId,
} from "@/lib/demo-personas";

// Demo mode is a development-only shortcut for testing with personas.
// Gate it on NODE_ENV so a leaked DEMO_MODE=true in a real customer
// environment does not silently switch auth to the cookie-persona path.
// Intentional demo deploys (demo.brandbite.studio) opt back in with
// ALLOW_DEMO_IN_PROD=true.
const isDemoMode = () => {
  if (process.env.DEMO_MODE !== "true") return false;
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.ALLOW_DEMO_IN_PROD === "true";
};

// ---------------------------------------------------------------------------
// Public API (unchanged signatures — used by all 59 API routes)
// ---------------------------------------------------------------------------

/**
 * Resolve the current authenticated user.
 * Returns null if not authenticated.
 *
 * Order of precedence (intentional — see file header):
 *   1. Real BetterAuth session, if one is active.
 *   2. Demo persona cookie, when DEMO_MODE is on AND no real session.
 *   3. null.
 *
 * This ordering means once a user signs in for real on a demo deploy,
 * they see THEIR account, not whichever persona was clicked earlier.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const real = await getCurrentUserFromBetterAuth();
  if (real) return real;
  if (isDemoMode()) {
    return getCurrentUserFromDemo();
  }
  return null;
}

/**
 * Helper that throws if there is no current user.
 */
export async function getCurrentUserOrThrow(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const error: Error & { code?: string } = new Error("UNAUTHENTICATED");
    error.code = "UNAUTHENTICATED";
    throw error;
  }
  return user;
}

/**
 * Helper that throws if the current user has no active company.
 */
export async function getActiveCompanyIdOrThrow(): Promise<string> {
  const user = await getCurrentUserOrThrow();
  if (!user.activeCompanyId) {
    const error: Error & { code?: string } = new Error("NO_ACTIVE_COMPANY");
    error.code = "NO_ACTIVE_COMPANY";
    throw error;
  }
  return user.activeCompanyId;
}

// ---------------------------------------------------------------------------
// Demo mode: bb-demo-user cookie → persona → email → UserAccount
// ---------------------------------------------------------------------------

async function getCurrentUserFromDemo(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const personaRaw = cookieStore.get("bb-demo-user")?.value;

  if (!personaRaw || !isValidDemoPersona(personaRaw)) {
    return null;
  }

  const email = getEmailForDemoPersona(personaRaw as DemoPersonaId);
  if (!email) return null;

  return resolveSessionUserByEmail(email);
}

// ---------------------------------------------------------------------------
// BetterAuth mode: session → authUserId → UserAccount
// ---------------------------------------------------------------------------

async function getCurrentUserFromBetterAuth(): Promise<SessionUser | null> {
  // Dynamic import keeps BetterAuth out of the cold-start critical path.
  // BetterAuth.getSession() is cookie-gated internally — no session cookie
  // means an early return with no DB query, so calling this on every
  // request (including demo-mode requests with no real session) is cheap.
  const { auth } = await import("@/lib/better-auth");

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) return null;

  const authUserId = session.user.id;
  const authEmail = session.user.email;
  const authName = session.user.name;

  // Look up our app's UserAccount by the BetterAuth user ID
  let user = await prisma.userAccount.findUnique({
    where: { authUserId },
    include: { companies: true },
  });

  // Soft-deleted accounts cannot sign in. Belt-and-suspenders: the deletion
  // flow also wipes AuthSession rows, but we short-circuit here in case a
  // session slipped through or a demo-mode user got deleted mid-cycle.
  if (user?.deletedAt) {
    return null;
  }

  // Auto-create or link UserAccount on first BetterAuth login
  if (!user) {
    // Check if a UserAccount exists with this email (e.g. from invite pre-creation)
    const existingByEmail = await prisma.userAccount.findUnique({
      where: { email: authEmail },
      include: { companies: true },
    });

    if (existingByEmail) {
      // Link existing UserAccount to this BetterAuth user
      user = await prisma.userAccount.update({
        where: { id: existingByEmail.id },
        data: { authUserId },
        include: { companies: true },
      });
    } else {
      // Create new UserAccount — default to CUSTOMER for self-service signups
      user = await prisma.userAccount.create({
        data: {
          authUserId,
          email: authEmail,
          name: authName || null,
          role: "CUSTOMER",
        },
        include: { companies: true },
      });
    }
  }

  const primaryMembership = user.companies[0] ?? null;

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    activeCompanyId: primaryMembership?.companyId ?? null,
    companyRole: primaryMembership?.roleInCompany ?? null,
  };
}

// ---------------------------------------------------------------------------
// Shared helper
// ---------------------------------------------------------------------------

async function resolveSessionUserByEmail(email: string): Promise<SessionUser | null> {
  const user = await prisma.userAccount.findUnique({
    where: { email },
    include: { companies: true },
  });

  if (!user || user.deletedAt) return null;

  const primaryMembership = user.companies[0] ?? null;

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    activeCompanyId: primaryMembership?.companyId ?? null,
    companyRole: primaryMembership?.roleInCompany ?? null,
  };
}
