// -----------------------------------------------------------------------------
// @file: lib/brand.ts
// @purpose: Single source of truth for the legal entity, postal address,
//           public contact email and copyright line. Imported by every
//           marketing footer, the auth/onboarding chrome, the legal pages
//           and the transactional email layout so a change here lands
//           everywhere at once.
//
//           Brandbite FZE was incorporated in 2026 (Sharjah Publishing City
//           Free Zone, UAE). Pure constants + pure helpers only — this file
//           is imported from both server and client components.
// -----------------------------------------------------------------------------

/** Registered legal entity name, as it should appear in © notices. */
export const COMPANY_LEGAL_NAME = "Brandbite FZE";

/** Public-facing brand name (not the legal entity). */
export const COMPANY_BRAND_NAME = "Brandbite";

/** Registered address, one entry per display line. */
export const COMPANY_ADDRESS_LINES = [
  "Business Centre, Sharjah Publishing City Free Zone",
  "Sharjah, United Arab Emirates",
] as const;

/** Registered address on a single line (footers, email, legal copy). */
export const COMPANY_ADDRESS = COMPANY_ADDRESS_LINES.join(", ");

/** General contact / support inbox. */
export const CONTACT_EMAIL = "hello@brandbite.studio";

/** Year of incorporation / first publication — the start of the © range. */
export const COPYRIGHT_START_YEAR = 2026;

/**
 * "2026" while we are still in the first year, then "2026–2027", "2026–2028",
 * … automatically. A range (first publication → current year) is the
 * conventional, legally tidy form and never needs a manual bump.
 */
export function copyrightYears(now: Date = new Date()): string {
  const current = now.getFullYear();
  return current > COPYRIGHT_START_YEAR
    ? `${COPYRIGHT_START_YEAR}–${current}`
    : `${COPYRIGHT_START_YEAR}`;
}

/** Full copyright line used in every footer. */
export function copyrightLine(now: Date = new Date()): string {
  return `© All rights reserved. Copyright ${COMPANY_LEGAL_NAME} © ${copyrightYears(now)}`;
}
