// -----------------------------------------------------------------------------
// @file: lib/permissions/companyRoles.ts
// @purpose: Permission helpers for company-level roles (OWNER / PM / BILLING / MEMBER)
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-16
// -----------------------------------------------------------------------------

// Keep this in sync with Prisma enum CompanyMemberRole (if you have one)
export type CompanyRole = "OWNER" | "PM" | "BILLING" | "MEMBER";

export function isCompanyAdminRole(role: CompanyRole | null | undefined) {
  if (!role) return false;
  return role === "OWNER" || role === "PM";
}

export function canViewCompanyMembers(role: CompanyRole | null | undefined) {
  // Members page / list
  return isCompanyAdminRole(role);
}

export function canManageCompanyInvites(
  role: CompanyRole | null | undefined,
) {
  // Create / cancel invites
  return isCompanyAdminRole(role);
}

export function canViewBillingAndPlan(
  role: CompanyRole | null | undefined,
) {
  // Plan, billing, token limits
  return role === "OWNER" || role === "BILLING";
}

export function canViewBoard(role: CompanyRole | null | undefined) {
  // Everyone in company can see the board
  return !!role;
}

export function canCreateTickets(role: CompanyRole | null | undefined) {
  // OWNER, PM, MEMBER: can create tickets
  // (BILLING sadece faturayla ilgilenen kişi ise, istersen buradan çıkarabiliriz)
  if (!role) return false;
  return role === "OWNER" || role === "PM" || role === "MEMBER";
}
