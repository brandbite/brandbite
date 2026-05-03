// -----------------------------------------------------------------------------
// @file: lib/turnstile.ts
// @purpose: Server-side verification for Cloudflare Turnstile tokens. Used by
//           the auth catch-all to gate sign-up requests on a successful CAPTCHA
//           challenge before BetterAuth ever sees the body.
//
//           Failure modes:
//             - TURNSTILE_SECRET_KEY unset → fail-OPEN (allow). Lets local dev
//               and CI pass without a real Cloudflare account. Production
//               must set the env var; absence on prod is a config bug, not a
//               security gap (the absence is intentional ops-only).
//             - Token missing on request → fail-CLOSED (deny).
//             - Cloudflare verify endpoint unreachable → fail-CLOSED (deny).
//               Timeouts can be benign (Cloudflare hiccup) but if the gate
//               were fail-open here, an attacker could DoS Cloudflare to
//               bypass the check. Returning 503 ("try again") is safer.
// -----------------------------------------------------------------------------

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Cap how long we'll wait for Cloudflare's verify endpoint. Same shape as
 *  every other outbound timeout in the app — keeps a hung Cloudflare from
 *  taking down the auth route via the 8s catch-all timeout. */
const VERIFY_TIMEOUT_MS = 4_000;

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: "missing-token" | "invalid-token" | "verify-failed" | "timeout" };

/**
 * Verify a Turnstile token against Cloudflare. Returns ok=true if the token
 * is valid OR if Turnstile is not configured (fail-open in dev/CI).
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  // Fail-open when not configured. Local dev and CI run without a real
  // Cloudflare account; the absence is ops policy, not an attack vector.
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[turnstile] TURNSTILE_SECRET_KEY not set in production — gate is bypassed. Set it in Vercel env vars.",
      );
    }
    return { ok: true };
  }

  if (!token || typeof token !== "string" || token.length < 10) {
    return { ok: false, reason: "missing-token" };
  }

  // Cloudflare expects an application/x-www-form-urlencoded body.
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp && remoteIp !== "unknown") body.append("remoteip", remoteIp);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), VERIFY_TIMEOUT_MS);

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: ctrl.signal,
    });

    if (!res.ok) {
      console.warn(`[turnstile] verify endpoint returned ${res.status}`);
      return { ok: false, reason: "verify-failed" };
    }

    const json = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (json.success === true) return { ok: true };

    console.warn("[turnstile] token rejected", json["error-codes"]);
    return { ok: false, reason: "invalid-token" };
  } catch (err) {
    const aborted = (err as Error)?.name === "AbortError";
    console.warn(`[turnstile] verify ${aborted ? "timed out" : "errored"}`, err);
    return { ok: false, reason: aborted ? "timeout" : "verify-failed" };
  } finally {
    clearTimeout(timer);
  }
}

/** Map a verification failure to a user-friendly UI string. */
export function turnstileErrorMessage(
  reason: Exclude<TurnstileResult, { ok: true }>["reason"],
): string {
  switch (reason) {
    case "missing-token":
      return "Please complete the security check before submitting.";
    case "invalid-token":
      return "Security check failed. Please refresh and try again.";
    case "timeout":
      return "Security check timed out. Please try again in a moment.";
    case "verify-failed":
    default:
      return "Security check is temporarily unavailable. Please try again shortly.";
  }
}
