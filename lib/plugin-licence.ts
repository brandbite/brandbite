// -----------------------------------------------------------------------------
// @file: lib/plugin-licence.ts
// @purpose: Pure helpers behind /api/plugins/* — site normalisation and the
//           signed, short-lived download tokens. Kept out of the route so they
//           can be unit-tested without a database.
// @version: v0.1.0
// @status: active
// @lastUpdate: 2026-08-31
// -----------------------------------------------------------------------------

import { createHmac, timingSafeEqual } from "crypto";

/**
 * The verdicts the WordPress plugin understands. Anything else it reads as
 * INVALID, so this list is a contract and not an implementation detail.
 */
export const LICENCE_STATUSES = [
  "active",
  "invalid",
  "expired",
  "limit_reached",
  "deactivated",
] as const;

export type LicenceStatus = (typeof LICENCE_STATUSES)[number];

// ---------------------------------------------------------------------------
// Site identity
// ---------------------------------------------------------------------------

/**
 * Reduce a site URL to the identity a seat is counted against.
 *
 * Scheme, `www.` and any trailing slash are dropped, because none of them
 * makes a site a different site. Without this a customer who installs an SSL
 * certificate silently consumes a second seat, and the first anyone hears of
 * it is a support email about a limit they have not actually reached.
 *
 * The path is kept: a WordPress install in a subfolder genuinely is a separate
 * site, and agencies do run several under one domain.
 */
export function normaliseSite(raw: string): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return `${host}${url.pathname}`.replace(/\/+$/, "");
  } catch {
    return trimmed
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .replace(/\/+$/, "")
      .toLowerCase();
  }
}

// ---------------------------------------------------------------------------
// Download tokens
// ---------------------------------------------------------------------------

/**
 * A token ties one download to one product for one hour.
 *
 * The version endpoint hands it out only to a site whose licence checked out.
 * An hour is long enough for WordPress to fetch the zip and short enough that
 * pasting the link into a forum achieves nothing. It is deliberately not tied
 * to the *site*, only the key: WordPress fetches the package from the same
 * server that asked for it, but through its own HTTP stack, and pinning the
 * site would break more installs than it would protect.
 */
export interface DownloadClaims {
  /** Product slug, e.g. "image-optimizer". */
  p: string;
  /** Licence key the token was issued to. */
  k: string;
  /** Expiry, seconds since the epoch. */
  e: number;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sign(payload: string, secret: string): string {
  return base64url(createHmac("sha256", secret).update(payload).digest());
}

export function signDownloadToken(
  product: string,
  key: string,
  secret: string,
  ttlSeconds = 3600,
): string {
  const claims: DownloadClaims = {
    p: product,
    k: key,
    e: Math.floor(Date.now() / 1000) + ttlSeconds,
  };

  const payload = base64url(JSON.stringify(claims));

  return `${payload}.${sign(payload, secret)}`;
}

/**
 * Verify a token and return its claims, or null.
 *
 * Null for every failure — bad signature, wrong product, expired, malformed —
 * because the caller has nothing useful to do with the distinction and telling
 * an attacker which part of their forgery was wrong is a gift.
 */
export function verifyDownloadToken(
  token: string,
  product: string,
  secret: string,
): DownloadClaims | null {
  if (!secret) return null;

  const parts = (token ?? "").split(".");
  if (parts.length !== 2) return null;

  const [payload, mac] = parts;
  if (!payload || !mac) return null;

  const expected = sign(payload, secret);

  // Length is checked first because timingSafeEqual throws on a mismatch
  // rather than returning false.
  const given = Buffer.from(mac);
  const want = Buffer.from(expected);
  if (given.length !== want.length) return null;
  if (!timingSafeEqual(given, want)) return null;

  let claims: DownloadClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64").toString("utf8")) as DownloadClaims;
  } catch {
    return null;
  }

  if (claims?.p !== product) return null;
  if (typeof claims?.e !== "number" || claims.e <= Date.now() / 1000) return null;
  if (typeof claims?.k !== "string" || !claims.k) return null;

  return claims;
}
