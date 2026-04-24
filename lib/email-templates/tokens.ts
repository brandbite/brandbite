// -----------------------------------------------------------------------------
// @file: lib/email-templates/tokens.ts
// @purpose: Single source of truth for Brandbite transactional email styling.
//           Colors, spacing, typography, container widths — all referenced
//           by lib/email-templates/layout.tsx and the individual templates.
//
//           Why this is separate from the app's CSS variables:
//           email clients don't support CSS variables reliably. React Email
//           inlines styles for us, so templates reference these constants
//           (plain strings / numbers) and the render step bakes them in.
// -----------------------------------------------------------------------------

/* ---------------------------------------------------------------------------
 * Brand palette — mirrors the CSS custom properties in globals.css but with
 * literal hex values so email clients render them consistently.
 * ------------------------------------------------------------------------- */

export const brand = {
  /** Primary CTA / accent color (same #f15b2b used in the app) */
  primary: "#f15b2b",
  /** Hover / pressed state for the primary */
  primaryDark: "#d94a1f",
  /** Dark body text — same charcoal as the app's --bb-secondary */
  text: "#424143",
  /** Muted / secondary text */
  textMuted: "#605c56",
  /** Very light grey background for dividers + subtle surfaces */
  border: "#e3e0da",
  /** Page background — warm off-white, matches --bb-bg-page */
  bg: "#fdfcfa",
  /** Card background — pure white for content blocks */
  card: "#ffffff",
  /** Callout background (soft warning / info) */
  calloutBg: "#fff6ea",
  /** Callout text */
  calloutText: "#7a4a00",
} as const;

/* ---------------------------------------------------------------------------
 * Typography
 *
 * Email clients are strict about fonts — custom webfonts rarely work
 * (only Apple Mail and iOS Mail render them reliably). We list the brand
 * fonts first with a safe system-font fallback so every client has
 * something reasonable to fall back to.
 * ------------------------------------------------------------------------- */

export const fonts = {
  body: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  heading:
    '"Josefin Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
} as const;

/* ---------------------------------------------------------------------------
 * Layout + spacing — kept in a small closed set so templates don't sprawl.
 * ------------------------------------------------------------------------- */

/**
 * Maximum content width. 600px is the long-standing safe ceiling for
 * email — Outlook for Windows 2007-2016 has issues past 650px, and many
 * corporate inbox previews are narrower than desktop browsers.
 */
export const MAX_WIDTH = 600;

/** Standard outer page padding */
export const PAGE_PADDING = "32px 24px";

/** Section vertical rhythm */
export const SECTION_GAP = "24px";

/* ---------------------------------------------------------------------------
 * Brand identity — surfaces referenced by the layout header + footer.
 *
 * IMPORTANT for CAN-SPAM / EU compliance: the footer must include a real
 * postal address once the legal entity is set up. Until then we leave
 * `BRAND_ADDRESS` as null and the footer renders without it; this is
 * acceptable for transactional emails while we're pre-launch / pre-entity,
 * but any marketing drip must wait until the address is filled in.
 * ------------------------------------------------------------------------- */

export const BRAND_NAME = "Brandbite";
export const BRAND_TAGLINE = "All your designs, one subscription.";
export const BRAND_WEBSITE = "https://brandbite.studio";
export const BRAND_SUPPORT_EMAIL = "support@brandbite.studio";

/** Postal address line for the CAN-SPAM / EU-required footer. Set when
 *  the legal entity has a registered address. Null renders nothing. */
export const BRAND_ADDRESS: string | null = null;
