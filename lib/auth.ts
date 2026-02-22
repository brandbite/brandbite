// -----------------------------------------------------------------------------
// @file: lib/auth.ts
// @purpose: Auth integration boundary — dual mode (demo cookie + BetterAuth).
//           DEMO_MODE=true  → demo persona cookie → email → UserAccount
//           DEMO_MODE=false → BetterAuth session → authUserId → UserAccount
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-02-22
// -----------------------------------------------------------------------------

import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "./roles";
import {
  getEmailForDemoPersona,
  isValidDemoPersona,
  type DemoPersonaId,
} from "@/lib/demo-personas";

const isDemoMode = () => process.env.DEMO_MODE === "true";

// ---------------------------------------------------------------------------
// Public API (unchanged signatures — used by all 59 API routes)
// ---------------------------------------------------------------------------

/**
 * Resolve the current authenticated user.
 * Returns null if not authenticated. The underlying mechanism depends on
 * DEMO_MODE: demo cookie in dev, BetterAuth session in production.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  if (isDemoMode()) {
    return getCurrentUserFromDemo();
  }
  return getCurrentUserFromBetterAuth();
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
  // Dynamic import to avoid loading BetterAuth when in demo mode
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

  if (!user) return null;

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
