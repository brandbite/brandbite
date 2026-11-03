// -----------------------------------------------------------------------------
// @file: lib/analytics.ts
// @purpose: Google Analytics 4 helpers — which routes may be tracked, and the
//           visitor's analytics-cookie consent (stored in localStorage).
//
//           GA is marketing-only: logged-in app areas, auth flows and any
//           tokenised URL (invites, password resets, schedule links) are never
//           sent to Google. Consent follows Google Consent Mode v2 — GA loads
//           with analytics_storage "denied" (cookieless pings) and only sets
//           cookies after the visitor accepts in the cookie banner.
//
//           Client-only helpers guard on `typeof window`.
// -----------------------------------------------------------------------------

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || "";

/**
 * Route prefixes GA must never see. Anything not listed here is treated as a
 * public marketing page. Prefer adding to this list over an allowlist so new
 * marketing pages are tracked by default, and keep every authenticated or
 * token-bearing route in it.
 */
const UNTRACKED_PREFIXES = [
  "/admin",
  "/customer",
  "/creative",
  "/board",
  "/debug",
  "/onboarding",
  "/invite",
  "/reset-password",
  "/verify-email",
  "/talent/schedule",
  "/api",
];

export function isTrackedPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return !UNTRACKED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// --- Consent -----------------------------------------------------------------

export type AnalyticsConsent = "granted" | "denied";

const CONSENT_KEY = "bb-analytics-consent";

/** Fired on window whenever the stored consent changes (or the banner is reopened). */
export const CONSENT_CHANGE_EVENT = "bb:analytics-consent";
export const OPEN_COOKIE_SETTINGS_EVENT = "bb:open-cookie-settings";

export function readConsent(): AnalyticsConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function writeConsent(value: AnalyticsConsent) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // Storage blocked — the choice still applies for this page view.
  }
  if (value === "denied") clearGaCookies();
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: value }));
}

export function openCookieSettings() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT));
}

/** Remove _ga / _ga_<id> cookies left behind when a visitor withdraws consent. */
function clearGaCookies() {
  const names = document.cookie
    .split(";")
    .map((c) => c.split("=")[0]?.trim())
    .filter((n): n is string => !!n && (n === "_ga" || n.startsWith("_ga_")));
  if (names.length === 0) return;

  // GA sets cookies on the registrable domain (e.g. .brandbite.studio), so try
  // each parent domain as well as the bare host.
  const parts = window.location.hostname.split(".");
  const domains = [""];
  for (let i = 0; i < parts.length - 1; i++) domains.push(`; domain=.${parts.slice(i).join(".")}`);

  for (const name of names) {
    for (const d of domains) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${d}`;
    }
  }
}
