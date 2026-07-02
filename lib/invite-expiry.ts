// -----------------------------------------------------------------------------
// @file: lib/invite-expiry.ts
// @purpose: Company-invite expiry policy in one place. Mirrors the talent
//           booking-token TTL helpers (lib/talent-booking-token.ts).
// -----------------------------------------------------------------------------

/** How long a company invite stays acceptable after it's created. */
export const COMPANY_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Expiry timestamp for a freshly-created invite (now + 7 days). */
export function companyInviteExpiresAt(): Date {
  return new Date(Date.now() + COMPANY_INVITE_TTL_MS);
}

/**
 * True when an invite is past its expiry. A null expiresAt (legacy rows
 * created before the column existed) is treated as non-expiring.
 */
export function isCompanyInviteExpired(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() <= Date.now();
}
