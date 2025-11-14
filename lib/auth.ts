// -----------------------------------------------------------------------------
// @file: lib/auth.ts
// @purpose: Auth integration boundary for Brandbite (demo session + future BetterAuth)
// @version: v0.2.1
// @status: active
// @lastUpdate: 2025-11-14
// -----------------------------------------------------------------------------

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "./roles";

/**
 * NOTE (2025-11-14):
 *
 * This file currently implements a "demo auth layer" based on a simple cookie:
 *
 *   - Cookie name: bb-demo-user
 *   - Value: one of the demo personas (see DEMO_PERSONA_TO_EMAIL)
 *   - We look up UserAccount by email, then infer activeCompanyId and companyRole
 *     from the first CompanyMember record.
 *
 * In the future, BetterAuth (or another provider) will plug in here by
 * replacing the internals of getCurrentUser() with real session lookup logic.
 * The rest of the app should keep using the SessionUser shape defined
 * in lib/roles.ts.
 */

const DEMO_PERSONA_TO_EMAIL: Record<string, string> = {
  // platform-level
  "site-owner": "owner@brandbite-demo.com",
  "site-admin": "admin@brandbite-demo.com",

  // designers
  "designer-ada": "ada.designer@demo.com",
  "designer-liam": "liam.designer@demo.com",

  // customer company (Acme Studio)
  "customer-owner": "owner@acme-demo.com",
  "customer-pm": "pm@acme-demo.com",
};

/**
 * Resolve the current user from the demo cookie and database.
 *
 * - If there is no bb-demo-user cookie, this returns null.
 * - If the persona or user is not found, this returns null.
 * - activeCompanyId and companyRole are taken from the first CompanyMember record.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  // In your Next version cookies() returns a Promise<ReadonlyRequestCookies>,
  // so we need to await it before calling .get().
  const cookieStore = await cookies();
  const persona = cookieStore.get("bb-demo-user")?.value;

  if (!persona) {
    return null;
  }

  const email = DEMO_PERSONA_TO_EMAIL[persona];
  if (!email) {
    return null;
  }

  const user = await prisma.userAccount.findUnique({
    where: { email },
    include: {
      companies: true, // CompanyMember[]
    },
  });

  if (!user) {
    return null;
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

/**
 * Helper that throws if there is no current user.
 * This is useful in API routes where you want hard guarantees.
 */
export async function getCurrentUserOrThrow(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const error = new Error("UNAUTHENTICATED");
    (error as any).code = "UNAUTHENTICATED";
    throw error;
  }
  return user;
}
