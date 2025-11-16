// -----------------------------------------------------------------------------
// @file: lib/permissions/companyRoles.ts
// @purpose: Centralized helpers for company-level roles and permissions (customer space)
// @version: v1.1.0
// @status: active
// @lastUpdate: 2025-11-16
// -----------------------------------------------------------------------------

/**
 * Company-level role for a user inside a Brandbite customer workspace.
 *
 * OWNER   - Owns the workspace, full access (billing + tickets + settings).
 * PM      - Manages tickets and workflow, but not billing.
 * BILLING - Handles billing, read-only for most ticket workflows.
 * MEMBER  - Regular contributor who can create and manage tickets.
 */
export type CompanyRole = "OWNER" | "PM" | "BILLING" | "MEMBER";

/**
 * Best-effort normalization for any incoming value to a CompanyRole or null.
 * Useful when reading from session objects or untyped sources.
 */
export function normalizeCompanyRole(
  role: unknown,
): CompanyRole | null {
  if (role === "OWNER" || role === "PM" || role === "BILLING" || role === "MEMBER") {
    return role;
  }
  return null;
}

/**
 * Who can manage subscription plan / billing settings.
 * Current rule: OWNER + BILLING.
 */
export function canManagePlan(
  role: CompanyRole | null | undefined,
): boolean {
  return role === "OWNER" || role === "BILLING";
}

/**
 * Generic billing management permission.
 * Kept separate from canManagePlan in case we diverge later.
 */
export function canManageBilling(
  role: CompanyRole | null | undefined,
): boolean {
  return role === "OWNER" || role === "BILLING";
}

/**
 * Who can create new tickets.
 * Current rule: everyone except BILLING (OWNER + PM + MEMBER).
 */
export function canCreateTickets(
  role: CompanyRole | null | undefined,
): boolean {
  return role === "OWNER" || role === "PM" || role === "MEMBER";
}

/**
 * Who can move tickets on the kanban board.
 * For now this mirrors canCreateTickets.
 */
export function canMoveTicketsOnBoard(
  role: CompanyRole | null | undefined,
): boolean {
  return canCreateTickets(role);
}

/**
 * Who can see tokens overview.
 * For now: all roles can see company usage.
 */
export function canViewTokens(
  _role: CompanyRole | null | undefined,
): boolean {
  return true;
}

/**
 * Convenience helper for "read-only because billing role" checks in UI.
 */
export function isBillingReadOnly(
  role: CompanyRole | null | undefined,
): boolean {
  return role === "BILLING";
}
