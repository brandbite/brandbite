// -----------------------------------------------------------------------------
// @file: lib/auth-error-messages.ts
// @purpose: Map BetterAuth error responses to user-friendly UI strings.
//           Without this layer, raw codes like "EMAIL_NOT_VERIFIED" or
//           "INVALID_PASSWORD" leak straight into the /login form and the
//           UI reads as if it were written for engineers.
// -----------------------------------------------------------------------------

/** Shape of the error object surfaced by BetterAuth's auth-client. */
export type AuthClientError = {
  code?: string;
  message?: string;
  status?: number;
} | null;

/**
 * Friendly copy keyed by BetterAuth's documented error codes plus a few
 * synonyms we've seen in the wild. Add new entries here when the UI surfaces
 * a raw code — keeps every login surface consistent.
 */
const FRIENDLY_BY_CODE: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Email or password is incorrect.",
  INVALID_PASSWORD: "Email or password is incorrect.",
  USER_NOT_FOUND: "No account found with that email. Try creating one instead.",
  USER_ALREADY_EXISTS: "This email is already registered. Try signing in instead.",
  USER_ALREADY_HAS_PASSWORD: "This account already has a password set.",
  EMAIL_NOT_VERIFIED: "Please verify your email before signing in.",
  PASSWORD_TOO_SHORT: "Password must be at least 12 characters.",
  PASSWORD_TOO_LONG: "Password is too long.",
  INVALID_EMAIL: "Please enter a valid email address.",
  TOO_MANY_REQUESTS: "Too many attempts. Please wait a few minutes and try again.",
  // Magic link plugin
  INVALID_TOKEN: "This link has expired. Request a new sign-in link.",
  EXPIRED_TOKEN: "This link has expired. Request a new sign-in link.",
};

/**
 * Convert an auth-client error into a sentence ready to drop into the UI.
 *
 * Order of precedence:
 *   1. Known code → curated copy.
 *   2. Server-provided message, if it looks like a sentence (already
 *      friendly — e.g. our rate-limit gate writes "Too many attempts for
 *      this email. Wait 15 minutes and try again.").
 *   3. Generic fallback so the user always sees something actionable.
 */
export function mapAuthError(err: AuthClientError, fallback?: string): string {
  if (!err) return fallback ?? "Something went wrong. Please try again.";

  const code = (err.code ?? "").toUpperCase();
  if (code && FRIENDLY_BY_CODE[code]) return FRIENDLY_BY_CODE[code];

  const message = err.message?.trim() ?? "";
  // Reject obviously-machine-generated messages (very long, full of
  // brackets/IDs) — those are the ones we DON'T want to show users.
  // A clean sentence under ~200 chars is fine to surface verbatim.
  if (message && message.length <= 200 && !/[{}<>]/.test(message)) {
    return message;
  }

  return fallback ?? "Something went wrong. Please try again.";
}

/**
 * Detect "you need to verify your email first" errors from sign-in. The UI
 * uses this to redirect the user to /verify-email instead of showing an
 * inline error.
 */
export function isUnverifiedEmailError(err: AuthClientError): boolean {
  if (!err) return false;
  const code = (err.code ?? "").toUpperCase();
  if (code.includes("EMAIL_NOT_VERIFIED")) return true;
  const message = (err.message ?? "").toLowerCase();
  return message.includes("verif");
}
