// -----------------------------------------------------------------------------
// @file: lib/roles.ts
// @purpose: Brandbite role helpers and shared auth-related types
// @version: v1.3.0
// @status: active
// @lastUpdate: 2026-02-20
// -----------------------------------------------------------------------------

import type { UserRole, CompanyRole } from "@prisma/client";

/**
 * Platform-level roles, coming from UserRole enum in Prisma.
 */
export type AppUserRole = UserRole;

/**
 * Minimal representation of an authenticated user that the UI / API
 * can rely on, independent of the underlying auth provider.
 *
 * - activeCompanyId: the company the user is currently operating in
 * - companyRole: company-level role (OWNER / PM / BILLING / MEMBER)
 */
export type SessionUser = {
  id: string;
  email: string;
  role: AppUserRole;
  name?: string | null;
  activeCompanyId?: string | null;
  companyRole?: CompanyRole | null;
};

/**
 * Convenience constant groups for role checks.
 * Note: The DB enum value is still DESIGNER (Prisma can't @map enum values).
 *       Display layer maps it to "Creative" via formatRole().
 */
export const SITE_ADMIN_ROLES: AppUserRole[] = ["SITE_OWNER", "SITE_ADMIN"];
export const CREATIVE_ROLES: AppUserRole[] = ["DESIGNER"];
export const CUSTOMER_ROLES: AppUserRole[] = ["CUSTOMER"];

/**
 * Returns true if the given role is considered a "platform admin"
 * (site-level, not company-level).
 */
export function isSiteAdminRole(role: AppUserRole): boolean {
  return SITE_ADMIN_ROLES.includes(role);
}

export function isCreativeRole(role: AppUserRole): boolean {
  return CREATIVE_ROLES.includes(role);
}

export function isCustomerRole(role: AppUserRole): boolean {
  return CUSTOMER_ROLES.includes(role);
}

/**
 * Returns true if user is operating inside a company context.
 * Useful for routes that require company scoping.
 */
export function hasActiveCompany(user: SessionUser): boolean {
  return Boolean(user.activeCompanyId);
}

/**
 * Company-level permission helper.
 * PM & OWNER can manage project/ticket workflows; others are more limited.
 */
export function isAtLeastCompanyPM(
  companyRole: CompanyRole | null | undefined,
): boolean {
  return companyRole === "OWNER" || companyRole === "PM";
}

/**
 * Tiny helper: format a role for debug / logs / UI.
 * Maps the DB enum value DESIGNER to the display name "Creative".
 */
export function formatRole(role: AppUserRole): string {
  switch (role) {
    case "SITE_OWNER":
      return "Site owner";
    case "SITE_ADMIN":
      return "Site admin";
    case "DESIGNER":
      return "Creative";
    case "CUSTOMER":
      return "Customer";
    default:
      return role;
  }
}
