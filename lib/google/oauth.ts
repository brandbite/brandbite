// -----------------------------------------------------------------------------
// @file: lib/google/oauth.ts
// @purpose: Zero-dep Google OAuth 2.0 helpers (authorize URL, code-for-tokens
//           exchange, refresh-token flow, revoke). Uses plain fetch against
//           Google's public OAuth endpoints — no googleapis package needed.
// -----------------------------------------------------------------------------

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
  "openid",
  "email",
] as const;

export type GoogleOauthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export function readGoogleOauthConfig(): GoogleOauthConfig | { error: string } {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  const missing: string[] = [];
  if (!clientId) missing.push("GOOGLE_OAUTH_CLIENT_ID");
  if (!clientSecret) missing.push("GOOGLE_OAUTH_CLIENT_SECRET");
  if (!redirectUri) missing.push("GOOGLE_OAUTH_REDIRECT_URI");
  if (missing.length > 0) {
    return { error: `Missing env var(s): ${missing.join(", ")}` };
  }
  return { clientId: clientId!, clientSecret: clientSecret!, redirectUri: redirectUri! };
}

/** Build the consent-screen redirect URL. Uses access_type=offline + prompt=consent
 *  so we always receive a refresh_token (even on re-auth). */
export function buildAuthorizeUrl(config: GoogleOauthConfig, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: GOOGLE_CALENDAR_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  refresh_token?: string;
  id_token?: string;
};

/** Exchange the authorization code from the callback for access + refresh tokens. */
export async function exchangeCodeForTokens(
  config: GoogleOauthConfig,
  code: string,
): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google token exchange failed (${res.status}): ${text}`);
  }
  return (await res.json()) as GoogleTokenResponse;
}

/** Use the refresh_token to get a new access_token. Google keeps the refresh
 *  token valid across refreshes — we should keep the stored value as-is. */
export async function refreshAccessToken(
  config: GoogleOauthConfig,
  refreshToken: string,
): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google token refresh failed (${res.status}): ${text}`);
  }
  return (await res.json()) as GoogleTokenResponse;
}

/** Revoke the given token (access or refresh). Best-effort; never throws. */
export async function revokeToken(token: string): Promise<void> {
  try {
    await fetch(`${REVOKE_ENDPOINT}?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      cache: "no-store",
    });
  } catch {
    // ignore — revocation is best-effort; the row will be cleared either way
  }
}

/** Decode id_token payload without verifying the signature. Cheap way to pull
 *  the user's email. Do NOT use this token for any auth decisions; it's just
 *  so we can display "Connected as foo@gmail.com". */
export function decodeIdTokenPayload(idToken: string): Record<string, unknown> | null {
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(payload);
  } catch {
    return null;
  }
}
