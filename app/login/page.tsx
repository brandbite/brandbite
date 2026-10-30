// -----------------------------------------------------------------------------
// @file: app/login/page.tsx
// @purpose: Combined sign-up / log-in page (2026 redesign). Email+password,
//           optional Google sign-in, magic link, login 2FA, Turnstile on
//           sign-up. Chrome (card, BB panel, footer) comes from
//           components/auth/auth-shell.tsx; this file owns the auth logic.
//           `?mode=signup` opens the sign-up tab (used by the homepage
//           "Start Now!" CTA); `?redirect=/path` routes there after login.
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-10-30
// -----------------------------------------------------------------------------

"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { authClient } from "@/lib/auth-client";
import {
  isUnverifiedEmailError,
  mapAuthError,
  type AuthClientError,
} from "@/lib/auth-error-messages";
import { PASSWORD_POLICY_BULLETS, validatePasswordStrength } from "@/lib/password-policy";
import { PasswordInput } from "@/components/ui/password-input";
import {
  AUTH_ERROR_CLASS,
  AUTH_INPUT_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_LINK_CLASS,
  AUTH_PRIMARY_BUTTON_CLASS,
  AUTH_SECONDARY_BUTTON_CLASS,
  AuthHeading,
  AuthShell,
} from "@/components/auth/auth-shell";

type Mode = "signin" | "signup";
type Status = "idle" | "submitting" | "magic-link-sent" | "awaiting-2fa" | "error";
type TwoFactorMode = "totp" | "backup";

const CHECKBOX_CLASS =
  "h-4 w-4 shrink-0 cursor-pointer rounded border-[#D7D8DD] accent-[#FF6426] focus:ring-1 focus:ring-[#FF6426]";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect");
  // Prevent open redirect: only allow internal paths (starts with / but not //)
  const redirectTo =
    rawRedirect && rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : null;

  const [mode, setMode] = useState<Mode>(
    searchParams.get("mode") === "signup" ? "signup" : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance | null>(null);

  // Login 2FA: when password sign-in succeeds against a 2FA-enrolled
  // account, BetterAuth deletes the session it just created and
  // returns `{ twoFactorRedirect: true }`. The page swaps into a TOTP /
  // backup-code input that POSTs the same auth client to the
  // verify-totp / verify-backup-code endpoints. The original session
  // doesn't issue until the second factor passes.
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorMode, setTwoFactorMode] = useState<TwoFactorMode>("totp");

  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  // Mirrors the server-side GOOGLE_CLIENT_ID/SECRET gate in lib/better-auth.ts.
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  // ---------------------------------------------------------------------------
  // Post-login redirect
  // ---------------------------------------------------------------------------

  async function handlePostLogin() {
    if (redirectTo) {
      router.push(redirectTo);
      return;
    }

    try {
      const res = await fetch("/api/session", { cache: "no-store" });
      const data = await res.json();
      const user = data?.user;

      if (!user) {
        router.push("/");
        return;
      }

      if (user.role === "SITE_OWNER" || user.role === "SITE_ADMIN") {
        router.push("/admin");
      } else if (user.role === "DESIGNER") {
        router.push("/creative/board");
      } else if (user.role === "CUSTOMER") {
        router.push(user.activeCompanyId ? "/customer/board" : "/onboarding");
      } else {
        router.push("/");
      }
    } catch {
      router.push("/");
    }
  }

  // ---------------------------------------------------------------------------
  // Email + Password handlers
  // ---------------------------------------------------------------------------

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }
    if (mode === "signup") {
      const check = validatePasswordStrength(password);
      if (!check.ok) {
        setError(check.error);
        return;
      }
      if (!agreedToTerms) {
        setError("Please agree to the Terms of Service and Privacy Policy to continue.");
        return;
      }
    }

    setStatus("submitting");

    try {
      if (mode === "signup") {
        // Turnstile gate — when the site key is present we require a token
        // before submitting. The widget renders below the form; this check
        // makes the failure UX immediate rather than letting the server
        // reject after a roundtrip.
        if (turnstileSiteKey && !turnstileToken) {
          setError("Please complete the security check below before submitting.");
          setStatus("error");
          return;
        }

        const { error: signUpError } = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: name.trim() || email.trim().split("@")[0],
          // Where to land the user AFTER they click the verification link.
          // BetterAuth bakes this into the verify-email URL it puts in the
          // mail (see node_modules/better-auth/dist/api/routes/sign-up.mjs:197).
          // Without it, the default is "/" — which dropped freshly-verified
          // users on the marketing landing page instead of the onboarding
          // wizard.
          callbackURL: "/onboarding",
          // Cloudflare Turnstile token. The auth catch-all verifies it
          // server-side via lib/turnstile.ts before BetterAuth's handler
          // runs. Empty string when Turnstile isn't configured (local dev,
          // CI) — the server-side check fails open in that case.
          turnstileToken: turnstileToken ?? "",
          // BetterAuth's body schema is .and(z.record(z.any())) so unknown
          // fields like turnstileToken pass through. Cast keeps TS happy
          // since the SDK's inferred body type doesn't include them.
        } as unknown as Parameters<typeof authClient.signUp.email>[0]);
        if (signUpError) {
          // Refresh the Turnstile token — it's single-use, even on the
          // server side. If we don't reset, the next submit re-uses the
          // already-spent token and gets 403'd.
          turnstileRef.current?.reset();
          setTurnstileToken(null);
          setError(mapAuthError(signUpError as AuthClientError, "Sign up failed."));
          setStatus("error");
          return;
        }

        // On demo (DEMO_MODE=true), email verification is disabled in
        // lib/better-auth.ts, so the user can sign in immediately.
        // Auto-attempt sign-in and route by role.
        if (isDemoMode) {
          const { error: signInError } = await authClient.signIn.email({
            email: email.trim(),
            password,
          });
          if (!signInError) {
            await handlePostLogin();
            return;
          }
          // Demo edge case (sign-in failed despite verification being
          // off) — fall through to the verify-email page so the user has
          // a clear next step instead of a stuck form.
        }

        // Real prod flow: sign-up succeeded, BetterAuth has dispatched
        // a verification email, the user has no session yet. Show them
        // the "check your inbox" page directly. Resending or escaping
        // happens from there.
        router.push(`/verify-email?email=${encodeURIComponent(email.trim())}`);
        return;
      }

      const { data: signInData, error: signInError } = await authClient.signIn.email({
        email: email.trim(),
        password,
        // Unchecked "Remember me" → session cookie only (cleared when the
        // browser closes) instead of BetterAuth's persistent default.
        rememberMe,
      });
      if (signInError) {
        if (isUnverifiedEmailError(signInError as AuthClientError)) {
          router.push(`/verify-email?email=${encodeURIComponent(email.trim())}&reason=unverified`);
          return;
        }
        setError(mapAuthError(signInError as AuthClientError, "Invalid email or password."));
        setStatus("error");
        return;
      }

      // 2FA gate: BetterAuth's twoFactor plugin returns
      // `twoFactorRedirect: true` (and no session) when the account
      // has 2FA enabled. Swap the page into the TOTP input — the
      // password is correct but we're not signed in yet until the
      // second factor verifies.
      if ((signInData as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) {
        setStatus("awaiting-2fa");
        setTwoFactorMode("totp");
        setTwoFactorCode("");
        return;
      }

      await handlePostLogin();
    } catch {
      setError("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  // ---------------------------------------------------------------------------
  // Google sign-in — BetterAuth social flow. Lands back on /login?callback=true
  // (or the requested redirect) so the role-based routing below applies to
  // Google users exactly as it does to password users.
  // ---------------------------------------------------------------------------

  async function handleGoogle() {
    setError(null);
    setStatus("submitting");
    try {
      const { error: socialError } = await authClient.signIn.social({
        provider: "google",
        callbackURL: redirectTo ?? "/login?callback=true",
      });
      if (socialError) {
        setError(mapAuthError(socialError as AuthClientError, "Google sign-in failed."));
        setStatus("error");
      }
      // On success the browser navigates to Google; nothing else to do.
    } catch {
      setError("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  // ---------------------------------------------------------------------------
  // Login 2FA verify handler — TOTP or backup code, swapped from the
  // same submit button. BetterAuth bound the temporary 2FA cookie when
  // the password sign-in returned twoFactorRedirect; these endpoints
  // trade that cookie for a real session on success.
  // ---------------------------------------------------------------------------

  async function handleTwoFactorSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const code = twoFactorCode.trim();
    if (!code) {
      setError(twoFactorMode === "totp" ? "Enter the 6-digit code." : "Enter a backup code.");
      return;
    }
    setStatus("submitting");
    try {
      const { error: verifyError } =
        twoFactorMode === "totp"
          ? await authClient.twoFactor.verifyTotp({ code })
          : await authClient.twoFactor.verifyBackupCode({ code });
      if (verifyError) {
        setError(
          mapAuthError(
            verifyError as AuthClientError,
            twoFactorMode === "totp"
              ? "Code didn't match. Try again, or use a backup code."
              : "Backup code didn't match. Each code only works once.",
          ),
        );
        setStatus("awaiting-2fa");
        return;
      }
      await handlePostLogin();
    } catch {
      setError("Something went wrong. Please try again.");
      setStatus("awaiting-2fa");
    }
  }

  // ---------------------------------------------------------------------------
  // Magic link handler
  // ---------------------------------------------------------------------------

  async function handleMagicLink() {
    setError(null);

    if (!email.trim()) {
      setError("Enter your email above and we'll send you a magic link.");
      return;
    }

    setStatus("submitting");

    try {
      const { error: mlError } = await authClient.signIn.magicLink({
        email: email.trim(),
        callbackURL: "/login?callback=true",
      });

      if (mlError) {
        setError(mapAuthError(mlError as AuthClientError, "Failed to send magic link."));
        setStatus("error");
        return;
      }

      setStatus("magic-link-sent");
    } catch {
      setError("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  // ---------------------------------------------------------------------------
  // Auto-redirect after magic link / Google callback
  // ---------------------------------------------------------------------------

  const isCallback = searchParams.get("callback") === "true";
  if (isCallback) {
    handlePostLogin();
    return (
      <AuthShell>
        <AuthHeading title="Signing you in…" subtitle="One second while we open your board." />
      </AuthShell>
    );
  }

  // ---------------------------------------------------------------------------
  // Magic link sent confirmation
  // ---------------------------------------------------------------------------

  if (status === "magic-link-sent") {
    return (
      <AuthShell>
        <AuthHeading title="Check your email" subtitle="Your sign-in link is on its way." />
        <p className="text-sm leading-6 text-[#2B2D33]">
          We sent a sign-in link to <span className="font-bold">{email}</span>. The link expires in
          5 minutes.
        </p>
        <button
          type="button"
          onClick={() => {
            setStatus("idle");
            setError(null);
          }}
          className={`mt-6 text-sm ${AUTH_LINK_CLASS}`}
        >
          Back to log in
        </button>
      </AuthShell>
    );
  }

  // ---------------------------------------------------------------------------
  // 2FA challenge — password verified, awaiting second factor
  //
  // Rendered when sign-in returned `twoFactorRedirect: true`. The
  // BetterAuth temporary cookie holds the pending session for 10 min
  // by default; we don't surface the timer because the user typically
  // grabs a code in a few seconds. "Use a backup code" toggle swaps
  // the input + endpoint without leaving the page.
  // ---------------------------------------------------------------------------

  if (status === "awaiting-2fa") {
    return (
      <AuthShell>
        <AuthHeading
          title="One more step."
          subtitle={
            twoFactorMode === "totp"
              ? "Open your authenticator app and enter the 6-digit code."
              : "Enter one of the backup codes you saved when you set up 2FA. Each code only works once."
          }
        />
        <form onSubmit={handleTwoFactorSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="twoFactorCode" className={AUTH_LABEL_CLASS}>
              {twoFactorMode === "totp" ? "Authenticator code" : "Backup code"}
            </label>
            <input
              id="twoFactorCode"
              type="text"
              inputMode={twoFactorMode === "totp" ? "numeric" : "text"}
              autoComplete="one-time-code"
              autoFocus
              value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value)}
              placeholder={twoFactorMode === "totp" ? "123 456" : "abcd-efgh-ijkl"}
              className={`${AUTH_INPUT_CLASS} tracking-widest`}
            />
          </div>
          {error && (
            <div role="alert" className={AUTH_ERROR_CLASS}>
              {error}
            </div>
          )}
          <button type="submit" className={AUTH_PRIMARY_BUTTON_CLASS}>
            Verify and continue
            <Image src="/home/arrow-white.svg" alt="" width={20} height={15.7} />
          </button>
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                setTwoFactorMode((m) => (m === "totp" ? "backup" : "totp"));
                setTwoFactorCode("");
                setError(null);
              }}
              className={AUTH_LINK_CLASS}
            >
              {twoFactorMode === "totp"
                ? "Use a backup code instead"
                : "Use the authenticator app instead"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStatus("idle");
                setTwoFactorCode("");
                setError(null);
              }}
              className="text-[#5E616E] hover:underline"
            >
              Cancel
            </button>
          </div>
        </form>
      </AuthShell>
    );
  }

  // ---------------------------------------------------------------------------
  // Main sign-up / log-in form
  // ---------------------------------------------------------------------------

  const isSignup = mode === "signup";
  const submitting = status === "submitting";

  return (
    <AuthShell>
      {/* ?expired=1 — arrives here when the SessionTimeoutWarning's
          countdown reached zero without the user clicking "Stay
          signed in". Plain banner; `role="status"` so screen readers
          announce it alongside the form title. */}
      {searchParams.get("expired") === "1" && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
        >
          Your session expired for security. Log in again to continue.
        </div>
      )}

      <AuthHeading
        title={isSignup ? "Let’s make it happen." : "Back for another bite?"}
        subtitle={
          isSignup ? "Your next great creative starts here." : "Your creative flow is waiting."
        }
      />

      {/* Mode toggle */}
      <div
        role="tablist"
        aria-label="Sign up or log in"
        className="mb-4 flex rounded-xl border border-[#D7D8DD] bg-white p-0.5"
      >
        {(
          [
            { key: "signup", label: "Sign up" },
            { key: "signin", label: "Log in" },
          ] as const
        ).map((tab) => {
          const active = mode === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => switchMode(tab.key)}
              className={`h-9 flex-1 rounded-[10px] text-sm font-bold transition-colors ${
                active ? "bg-[#FF6426] text-white" : "text-[#2B2D33] hover:text-[#FF6426]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Google */}
      {googleEnabled && (
        <>
          <button
            type="button"
            onClick={handleGoogle}
            disabled={submitting}
            className={AUTH_SECONDARY_BUTTON_CLASS}
          >
            <Image src="/home/google-g.svg" alt="" width={20} height={20} />
            Continue with Google
          </button>
          <div className="my-4 flex items-center gap-3 text-xs text-[#5E616E]">
            <span className="h-px flex-1 bg-[#D7D8DD]" />
            {isSignup ? "or sign up with email" : "or log in with email"}
            <span className="h-px flex-1 bg-[#D7D8DD]" />
          </div>
        </>
      )}

      {/* Form */}
      <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3.5" noValidate>
        {isSignup && (
          <div>
            <label htmlFor="login-name" className={AUTH_LABEL_CLASS}>
              Full name
            </label>
            <input
              id="login-name"
              type="text"
              value={name}
              onChange={(e) => {
                if (error) setError(null);
                setName(e.target.value);
              }}
              placeholder="Your name"
              autoComplete="name"
              aria-describedby={error ? "login-error" : undefined}
              className={AUTH_INPUT_CLASS}
            />
          </div>
        )}

        <div>
          <label htmlFor="login-email" className={AUTH_LABEL_CLASS}>
            {isSignup ? "Work email" : "Email address"}
          </label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => {
              if (error) setError(null);
              setEmail(e.target.value);
            }}
            placeholder="you@company.com"
            autoComplete="email"
            required
            aria-describedby={error ? "login-error" : undefined}
            className={AUTH_INPUT_CLASS}
          />
        </div>

        <div>
          <label htmlFor="login-password" className={AUTH_LABEL_CLASS}>
            Password
          </label>
          <PasswordInput
            id="login-password"
            value={password}
            onChange={(e) => {
              if (error) setError(null);
              setPassword(e.target.value);
            }}
            placeholder={isSignup ? "Create a password" : "Your password"}
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            aria-describedby={error ? "login-error" : isSignup ? "login-password-rules" : undefined}
          />
          {isSignup &&
            (password ? (
              <PasswordRulesChecklist id="login-password-rules" password={password} />
            ) : (
              <p id="login-password-rules" className="mt-1.5 text-xs text-[#5E616E]">
                At least 12 characters, with a number and a symbol.
              </p>
            ))}
        </div>

        {isSignup ? (
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-[#2B2D33]">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => {
                if (error) setError(null);
                setAgreedToTerms(e.target.checked);
              }}
              className={`${CHECKBOX_CLASS} mt-0.5`}
            />
            <span>
              I agree to the{" "}
              <Link
                href="/terms"
                className="font-semibold underline underline-offset-2 hover:text-[#FF6426]"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="font-semibold underline underline-offset-2 hover:text-[#FF6426]"
              >
                Privacy Policy
              </Link>
            </span>
          </label>
        ) : (
          <div className="flex items-center justify-between text-sm">
            <label className="flex cursor-pointer items-center gap-2.5 text-[#2B2D33]">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className={CHECKBOX_CLASS}
              />
              Remember me
            </label>
            <Link href="/reset-password" className={AUTH_LINK_CLASS}>
              Forgot password?
            </Link>
          </div>
        )}

        {/* Cloudflare Turnstile — anti-bot challenge on signup only.
            "Managed" mode means most humans see nothing (invisible);
            bots and suspicious traffic get an interactive challenge.
            We only render this when the site key is configured —
            local dev/CI without Cloudflare keeps working. */}
        {isSignup && turnstileSiteKey && (
          <div className="flex justify-center">
            <Turnstile
              ref={turnstileRef}
              siteKey={turnstileSiteKey}
              onSuccess={(token) => setTurnstileToken(token)}
              onError={() => setTurnstileToken(null)}
              onExpire={() => setTurnstileToken(null)}
              options={{
                theme: "light",
                size: "flexible",
              }}
            />
          </div>
        )}

        {/* Error message — aria-describedby on each input above points
            at this id so screen readers associate the error with the
            failing field. role=alert announces it immediately. */}
        {error && (
          <p id="login-error" role="alert" className={AUTH_ERROR_CLASS}>
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting} className={AUTH_PRIMARY_BUTTON_CLASS}>
          {submitting ? "Please wait…" : isSignup ? "Create account" : "Log in"}
          {!submitting && <Image src="/home/arrow-white.svg" alt="" width={20} height={15.7} />}
        </button>
      </form>

      {/* Switch mode */}
      <p className="mt-4 text-center text-sm text-[#2B2D33]">
        {isSignup ? "Already have an account? " : "New to Brandbite? "}
        <button
          type="button"
          onClick={() => switchMode(isSignup ? "signin" : "signup")}
          className={AUTH_LINK_CLASS}
        >
          {isSignup ? "Log in" : "Create an account"}
        </button>
      </p>

      {/* Magic link — password-free alternative for existing accounts. */}
      {!isSignup && (
        <p className="mt-2 text-center text-xs text-[#5E616E]">
          Prefer no password?{" "}
          <button
            type="button"
            onClick={handleMagicLink}
            disabled={submitting}
            className="font-semibold text-[#2B2D33] underline underline-offset-2 hover:text-[#FF6426] disabled:opacity-60"
          >
            Email me a magic link
          </button>
        </p>
      )}

      {/* Demo mode link */}
      {isDemoMode && (
        <p className="mt-4 border-t border-[#E6E2DD] pt-3 text-center text-xs">
          <a href="/debug/demo-user" className={AUTH_LINK_CLASS}>
            Use demo personas instead
          </a>
        </p>
      )}
    </AuthShell>
  );
}

/**
 * Live password-policy checklist shown below the sign-up password field
 * once the user starts typing. Each bullet turns green when its rule
 * passes. Uses `useMemo` so the test callbacks run once per keystroke
 * rather than on every re-render.
 */
function PasswordRulesChecklist({ id, password }: { id: string; password: string }) {
  const results = useMemo(
    () => PASSWORD_POLICY_BULLETS.map((rule) => ({ ...rule, passed: rule.test(password) })),
    [password],
  );
  return (
    <ul
      id={id}
      className="mt-2 space-y-0.5 text-xs text-[#5E616E]"
      aria-label="Password requirements"
    >
      {results.map((rule) => (
        <li key={rule.key} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
              rule.passed ? "bg-green-100 text-green-700" : "bg-[#EEEBE7] text-[#9A9CA5]"
            }`}
          >
            {rule.passed ? "✓" : "•"}
          </span>
          <span className={rule.passed ? "text-[#2B2D33]" : ""}>{rule.label}</span>
        </li>
      ))}
    </ul>
  );
}
