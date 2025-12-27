// -----------------------------------------------------------------------------
// @file: lib/auth.ts
// @purpose: Auth integration boundary for Brandbite (demo session + future BetterAuth)
// @version: v0.5.2
// @status: active
// @lastUpdate: 2025-12-27
// -----------------------------------------------------------------------------

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "./roles";
import {
  getEmailForDemoPersona,
  isValidDemoPersona,
  type DemoPersonaId,
} from "@/lib/demo-personas";

/**
 * NOTE (2025-11-16):
 *
 * Bu dosya şu an "demo auth layer" mantığını uygular:
 *
 *   - Cookie adı: bb-demo-user
 *   - Değer: demo persona id'lerinden biri (lib/demo-personas.ts içindeki DemoPersonaId)
 *   - Persona id -> email çözümü, DEMO_PERSONAS config'i üzerinden yapılır.
 *   - Email ile UserAccount bulunur, sonra ilk CompanyMember kaydından
 *     activeCompanyId ve companyRole türetilir.
 *
 * Gelecekte BetterAuth (veya başka bir provider) burada devreye girip
 * getCurrentUser() içindeki logic'i gerçek session mekanizmasıyla
 * değiştirecek. Uygulamanın geri kalanı sadece lib/roles.ts içindeki
 * SessionUser tipini kullanacak.
 */

/**
 * Resolve the current user from the demo cookie and database.
 *
 * - If there is no bb-demo-user cookie, this returns null.
 * - If the persona or user is not found, this returns null.
 * - activeCompanyId and companyRole are taken from the first CompanyMember record.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  // Next sürümünde cookies() Promise<ReadonlyRequestCookies> döndüğü için
  // .get() çağırmadan önce await etmemiz gerekiyor.
  const cookieStore = await cookies();
  const personaRaw = cookieStore.get("bb-demo-user")?.value;

  if (!personaRaw) {
    return null;
  }

  // Persona id geçerli değilse kullanıcı yokmuş gibi davran
  if (!isValidDemoPersona(personaRaw)) {
    return null;
  }

  const personaId = personaRaw as DemoPersonaId;
  const email = getEmailForDemoPersona(personaId);

  if (!email) {
    // Config ile DB seed'i uyumsuzsa da kullanıcı yokmuş gibi davranıyoruz
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
    const error: Error & { code?: string } = new Error("UNAUTHENTICATED");
    error.code = "UNAUTHENTICATED";
    throw error;
  }
  return user;
}

/**
 * Helper that throws if the current user has no active company.
 * Useful for API routes that are scoped to a company (tickets, assets, etc.).
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
