// -----------------------------------------------------------------------------
// @file: lib/talent-booking-token.ts
// @purpose: Single-use token for the public talent-application booking page
//           at /talent/schedule/[token]. Generated when the SITE_OWNER
//           clicks "Accept & schedule"; consumed when the candidate picks a
//           slot or proposes their own; expires after 7 days regardless.
//
//           Mirrors the CompanyInvite token pattern in prisma/schema.prisma:
//           plain (not hashed) string stored on the row, looked up by direct
//           equality. Plain is fine here — the surface is one row, one URL,
//           single-use, and time-limited; a hash would add lookup overhead
//           with no security upside given the URL itself is the secret.
// -----------------------------------------------------------------------------

import { randomBytes } from "node:crypto";

/** 7-day validity window — a candidate who got the email and forgets for a
 *  week needs a re-issue from the admin (which is also when the admin
 *  would naturally remember to follow up). Longer than a magic-link
 *  (5 min) but shorter than an open invitation. */
export const TALENT_BOOKING_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Generate a fresh booking token. 32 bytes of crypto randomness encoded
 *  as base64url (URL-safe, no padding) so it drops cleanly into a path
 *  segment without escaping. ~43 chars long. */
export function generateBookingToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Compute the absolute URL the candidate clicks in the email. Reads
 *  NEXT_PUBLIC_APP_URL so the same code works for prod, demo, and local. */
export function buildBookingUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || "http://localhost:3000";
  return `${base}/talent/schedule/${token}`;
}

/** Returns a Date 7 days from now. Pulled into a helper so the magic
 *  number stays in one place and tests can mock it via Date.now. */
export function bookingTokenExpiresAt(): Date {
  return new Date(Date.now() + TALENT_BOOKING_TOKEN_TTL_MS);
}

/** True when an expiry instant is in the past (or null). The booking
 *  endpoints call this on every read so a candidate clicking after 7
 *  days sees a clear "link expired" page rather than a generic 404. */
export function isBookingTokenExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() < Date.now();
}
