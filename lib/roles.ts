// -----------------------------------------------------------------------------
// @file: lib/roles.ts
// @purpose: Brandbite role helpers and shared auth-related types
// @version: v1.1.0
// @status: active
// @lastUpdate: 2025-11-14
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
 */
export const SITE_ADMIN_ROLES: AppUserRole[] = ["SITE_OWNER", "SITE_ADMIN"];
export const DESIGNER_ROLES: AppUserRole[] = ["DESIGNER"];
export const CUSTOMER_ROLES: AppUserRole[] = ["CUSTOMER"];

/**
 * Returns true if the given role is considered a "platform admin"
 * (site-level, not company-level).
 */
export function isSiteAdminRole(role: AppUserRole): boolean {
  return SITE_ADMIN_ROLES.includes(role);
}

export function isDesignerRole(role: AppUserRole): boolean {
  return DESIGNER_ROLES.includes(role);
}

export function isCustomerRole(role: AppUserRole): boolean {
  return CUSTOMER_ROLES.includes(role);
}

/**
 * Tiny helper: format a role for debug / logs.
 */
export function formatRole(role: AppUserRole): string {
  switch (role) {
    case "SITE_OWNER":
      return "Site owner";
    case "SITE_ADMIN":
      return "Site admin";
    case "DESIGNER":
      return "Designer";
    case "CUSTOMER":
      return "Customer";
    default:
      return role;
  }
}