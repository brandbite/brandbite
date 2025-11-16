// -----------------------------------------------------------------------------
// @file: lib/permissions/companyRoles.ts
// @purpose: Permission helpers for company-level roles (OWNER / PM / BILLING / MEMBER)
// @version: v1.2.0
// @status: active
// @lastUpdate: 2025-11-16
// -----------------------------------------------------------------------------

import type { CompanyRole as PrismaCompanyRole } from "@prisma/client";

/**
 * Re-export Prisma CompanyRole as our canonical type for UI + API helpers.
 *
 * Values: "OWNER" | "PM" | "BILLING" | "MEMBER"
 */
export type CompanyRole = PrismaCompanyRole;

/**
 * Best-effort normalization from any unknown value to a CompanyRole (or null).
 * Useful when reading from JSON payloads / session data.
 */
export function normalizeCompanyRole(role: unknown): CompanyRole | null {
  if (
    role === "OWNER" ||
    role === "PM" ||
    role === "BILLING" ||
    role === "MEMBER"
  ) {
    return role;
  }
  return null;
}

/**
 * Company-level "admin" access: OWNER + PM.
 */
export function isCompanyAdminRole(
  role: CompanyRole | null | undefined,
): boolean {
  if (!role) return false;
  return role === "OWNER" || role === "PM";
}

/**
 * Plan / subscription management: OWNER + BILLING.
 */
export function canManagePlan(role: CompanyRole | null | undefined): boolean {
  if (!role) return false;
  return role === "OWNER" || role === "BILLING";
}

/**
 * Billing management convenience helper (same as plan for now).
 */
export function canManageBilling(
  role: CompanyRole | null | undefined,
): boolean {
  if (!role) return false;
  return role === "OWNER" || role === "BILLING";
}

/**
 * Board visibility: anyone who is actually a member of the company.
 */
export function canViewBoard(role: CompanyRole | null | undefined): boolean {
  return !!role;
}

/**
 * Who can create new tickets on the customer side.
 *
 * - OWNER, PM, MEMBER: can create
 * - BILLING: cannot create (read-only for tickets)
 */
export function canCreateTickets(
  role: CompanyRole | null | undefined,
): boolean {
  if (!role) return false;
  return role === "OWNER" || role === "PM" || role === "MEMBER";
}

/**
 * Who can move tickets on the board (kanban).
 * For now we mirror canCreateTickets, so BILLING is read-only.
 */
export function canMoveTicketsOnBoard(
  role: CompanyRole | null | undefined,
): boolean {
  return canCreateTickets(role);
}

/**
 * Tokens overview visibility: everyone inside the workspace for now.
 */
export function canViewTokens(_role: CompanyRole | null | undefined): boolean {
  return true;
}

/**
 * Convenience helper for UI copy: "is this user read-only because they
 * are only marked as BILLING for the company?"
 */
export function isBillingReadOnly(
  role: CompanyRole | null | undefined,
): boolean {
  return role === "BILLING";
}

export function canMarkTicketsDoneForCompany(
  globalRole: string | null | undefined,
  companyRole: CompanyRole | null | undefined,
): boolean {
  if (!globalRole) return false;

  // Site-level admins can always force-close tickets
  if (globalRole === "SITE_OWNER" || globalRole === "SITE_ADMIN") {
    return true;
  }

  // Only customers can use companyRole-based rules
  if (globalRole !== "CUSTOMER") {
    return false;
  }

  // Within a company, only OWNER + PM can mark tickets as DONE
  return companyRole === "OWNER" || companyRole === "PM";
}

