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
 * (site-level, not company-level). Includes both SITE_OWNER and
 * SITE_ADMIN — used for day-to-day admin surfaces where either role
 * is sufficient (content moderation, viewing companies, managing
 * consultations, etc.).
 */
export function isSiteAdminRole(role: AppUserRole): boolean {
  return SITE_ADMIN_ROLES.includes(role);
}

/**
 * Returns true only for SITE_OWNER. Used to gate sensitive actions
 * that SITE_ADMIN should NOT be able to perform — see the
 * owner-only capability helpers below.
 */
export function isSiteOwnerRole(role: AppUserRole): boolean {
  return role === "SITE_OWNER";
}

/* ---------------------------------------------------------------------------
 * Owner-only capability helpers
 *
 * These gate actions that can move money, change compensation structure,
 * or escalate another user's privileges. SITE_ADMIN is intentionally NOT
 * permitted to perform these — only SITE_OWNER. See
 * docs/production-roadmap.md for the policy rationale.
 *
 * Named per-capability (rather than calling isSiteOwnerRole everywhere)
 * so we can later flip individual actions admin-ok without hunting
 * through the codebase.
 * ------------------------------------------------------------------------- */

/** Promoting any user to SITE_ADMIN or SITE_OWNER. Also covers
 *  demoting an existing SITE_ADMIN/SITE_OWNER. */
export function canPromoteToSiteAdmin(role: AppUserRole): boolean {
  return isSiteOwnerRole(role);
}

/** Approve a pending withdrawal (commits the company toward paying
 *  a creative). */
export function canApproveWithdrawals(role: AppUserRole): boolean {
  return isSiteOwnerRole(role);
}

/** Mark an approved withdrawal as PAID (records that the money
 *  actually left). */
export function canMarkWithdrawalsPaid(role: AppUserRole): boolean {
  return isSiteOwnerRole(role);
}

/** Create / edit / delete subscription Plans (and their Stripe
 *  product + price IDs). Revenue configuration. */
export function canManagePlans(role: AppUserRole): boolean {
  return isSiteOwnerRole(role);
}

/** Assign a specific Plan to a Company (changes their Stripe
 *  billing + monthly token allotment). */
export function canAssignCompanyPlan(role: AppUserRole): boolean {
  return isSiteOwnerRole(role);
}

/** Edit the gamification Payout Rules that drive creative
 *  compensation tiers. */
export function canEditPayoutRules(role: AppUserRole): boolean {
  return isSiteOwnerRole(role);
}

/** Manually grant or revoke tokens on a specific Company (direct
 *  ledger adjustment). */
export function canGrantCompanyTokens(role: AppUserRole): boolean {
  return isSiteOwnerRole(role);
}

/** Review the public talent-application queue: accept (creates Google
 *  Calendar event + sends interview email) or decline (sends polite
 *  rejection). SITE_OWNER only by design — hiring decisions are not a
 *  delegable SITE_ADMIN action, and the Google Calendar event lands on
 *  the singleton ConsultationSettings calendar (likely owner@). */
export function canManageTalentApplications(role: AppUserRole): boolean {
  return isSiteOwnerRole(role);
}

/** Override a ticket's tokenCost or creativePayout (direct financial
 *  override that sidesteps the normal cost/payout calculation). */
export function canOverrideTicketFinancials(role: AppUserRole): boolean {
  return isSiteOwnerRole(role);
}

/** Edit Consultation Settings (token cost, duration, buffer, Google
 *  OAuth connect/disconnect). */
export function canEditConsultationSettings(role: AppUserRole): boolean {
  return isSiteOwnerRole(role);
}

/** Edit the tokenCost / rateLimit of an AI tool. SITE_ADMIN can still
 *  toggle tools enabled/disabled (see canToggleAiToolEnabled). */
export function canEditAiToolPricing(role: AppUserRole): boolean {
  return isSiteOwnerRole(role);
}

/** Toggle an AI tool on or off. Admin-level operational control,
 *  distinct from editing its pricing. */
export function canToggleAiToolEnabled(role: AppUserRole): boolean {
  return isSiteAdminRole(role);
}

/** Permanently delete a user account (as opposed to the
 *  customer-initiated GDPR anonymize flow, which any user can do
 *  on their own account). */
export function canHardDeleteUsers(role: AppUserRole): boolean {
  return isSiteOwnerRole(role);
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
export function isAtLeastCompanyPM(companyRole: CompanyRole | null | undefined): boolean {
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
