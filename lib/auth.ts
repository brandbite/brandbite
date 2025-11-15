// -----------------------------------------------------------------------------
// @file: lib/auth.ts
// @purpose: Auth integration boundary for Brandbite (demo session + future BetterAuth)
// @version: v0.3.0
// @status: active
// @lastUpdate: 2025-11-15
// -----------------------------------------------------------------------------

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "./roles";
import {
  getEmailForDemoPersona,
  isValidDemoPersona,
} from "./demo-personas";

/**
 * NOTE (2025-11-14):
 *
 * This file currently implements a "demo auth layer" based on a simple cookie:
 *
 *   - Cookie name: bb-demo-user
 *   - Value: one of the demo personas (see lib/demo-personas.ts)
 *   - We look up UserAccount by email, then infer activeCompanyId and companyRole
 *     from the first CompanyMember record.
 *
 * In the future, BetterAuth (or another provider) will plug in here by
 * replacing the internals of getCurrentUser() with real session lookup logic.
 * The rest of the app should keep using the SessionUser shape defined
 * in lib/roles.ts.
 */

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

  if (!persona || !isValidDemoPersona(persona)) {
    return null;
  }

  const email = getEmailForDemoPersona(persona);
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
