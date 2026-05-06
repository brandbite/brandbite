// -----------------------------------------------------------------------------
// @file: app/login/page.tsx
// @purpose: Combined sign-in / sign-up page with email+password and magic link.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-02-22
// -----------------------------------------------------------------------------

"use client";

import { useMemo, useRef, useState } from "react";
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

type Mode = "signin" | "signup";
type Status = "idle" | "submitting" | "magic-link-sent" | "awaiting-2fa" | "error";
type TwoFactorMode = "totp" | "backup";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect");
  // Prevent open redirect: only allow internal paths (starts with / but not //)
  const redirectTo =
    rawRedirect && rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : null;

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
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
      setError("Enter your email to receive a magic link.");
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
  // Auto-redirect after magic link callback
  // ---------------------------------------------------------------------------

  const isCallback = searchParams.get("callback") === "true";
  if (isCallback) {
    handlePostLogin();
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bb-bg-page)]">
        <p className="text-sm text-[var(--bb-text-secondary)]">Signing you in...</p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Magic link sent confirmation
  // ---------------------------------------------------------------------------

  if (status === "magic-link-sent") {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--bb-bg-page)]">
        <header className="flex items-center border-b border-[var(--bb-border-subtle)] px-6 py-4">
          <Link href="/" className="text-lg font-bold text-[var(--bb-secondary)]">
            <span className="text-[var(--bb-primary)]">b</span>randbite
          </Link>
        </header>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6">
          <div className="w-full rounded-2xl border border-[var(--bb-border-subtle)] bg-[var(--bb-bg-card)] p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bb-primary)]/10">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-6 w-6 text-[var(--bb-primary)]"
              >
                <path d="M1.5 8.67v8.58a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V8.67l-8.928 5.493a3 3 0 0 1-3.144 0L1.5 8.67Z" />
                <path d="M22.5 6.908V6.75a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3v.158l9.714 5.978a1.5 1.5 0 0 0 1.572 0L22.5 6.908Z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[var(--bb-secondary)]">Check your email</h2>
            <p className="mt-2 text-sm text-[var(--bb-text-secondary)]">
              We sent a sign-in link to{" "}
              <span className="font-medium text-[var(--bb-secondary)]">{email}</span>
            </p>
            <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
              The link expires in 5 minutes.
            </p>
            <button
              onClick={() => {
                setStatus("idle");
                setError(null);
              }}
              className="mt-6 text-sm font-medium text-[var(--bb-primary)] hover:underline"
            >
              Back to sign in
            </button>
          </div>
        </div>
      </div>
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

  if (status === "awaiting-2fa" || status === "submitting") {
    if (status === "awaiting-2fa") {
      return (
        <div className="flex min-h-screen flex-col bg-[var(--bb-bg-page)]">
          <header className="flex items-center border-b border-[var(--bb-border-subtle)] px-6 py-4">
            <Link href="/" className="text-lg font-bold text-[var(--bb-secondary)]">
              <span className="text-[var(--bb-primary)]">b</span>randbite
            </Link>
          </header>
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6">
            <div className="w-full rounded-2xl border border-[var(--bb-border-subtle)] bg-[var(--bb-bg-card)] p-8 shadow-sm">
              <h2 className="text-xl font-bold text-[var(--bb-secondary)]">
                Two-factor authentication
              </h2>
              <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
                {twoFactorMode === "totp"
                  ? "Open your authenticator app and enter the 6-digit code."
                  : "Enter one of the backup codes you saved when you set up 2FA. Each code only works once."}
              </p>
              <form onSubmit={handleTwoFactorSubmit} className="mt-6 space-y-4">
                <div>
                  <label
                    htmlFor="twoFactorCode"
                    className="block text-xs font-medium text-[var(--bb-text-secondary)]"
                  >
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
                    className="mt-1 w-full rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] px-3 py-2 text-base tracking-widest text-[var(--bb-secondary)] outline-none focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)]"
                  />
                </div>
                {error && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
                  >
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  className="w-full rounded-xl bg-[var(--bb-primary)] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  Verify and continue
                </button>
                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setTwoFactorMode((m) => (m === "totp" ? "backup" : "totp"));
                      setTwoFactorCode("");
                      setError(null);
                    }}
                    className="font-medium text-[var(--bb-primary)] hover:underline"
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
                    className="text-[var(--bb-text-muted)] hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Main login form
  // ---------------------------------------------------------------------------

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bb-bg-page)]">
      {/* Header */}
      <header className="flex items-center border-b border-[var(--bb-border-subtle)] px-6 py-4">
        <Link href="/" className="text-lg font-bold text-[var(--bb-secondary)]">
          <span className="text-[var(--bb-primary)]">b</span>randbite
        </Link>
      </header>

      {/* Content */}
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6">
        <div className="w-full rounded-2xl border border-[var(--bb-border-subtle)] bg-[var(--bb-bg-card)] p-8 shadow-sm">
          {/* ?expired=1 — arrives here when the SessionTimeoutWarning's
              countdown reached zero without the user clicking "Stay
              signed in". Plain banner; `role="status"` so screen readers
              announce it alongside the form title. */}
          {searchParams.get("expired") === "1" && (
            <div
              role="status"
              className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
            >
              Your session expired for security. Sign in again to continue.
            </div>
          )}
          {/* Mode toggle */}
          <div className="mb-6 flex rounded-xl bg-[var(--bb-bg-page)] p-1">
            <button
              onClick={() => {
                setMode("signin");
                setError(null);
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                mode === "signin"
                  ? "bg-[var(--bb-bg-card)] text-[var(--bb-secondary)] shadow-sm"
                  : "text-[var(--bb-text-muted)] hover:text-[var(--bb-text-secondary)]"
              }`}
            >
              Sign in
            </button>
            <button
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                mode === "signup"
                  ? "bg-[var(--bb-bg-card)] text-[var(--bb-secondary)] shadow-sm"
                  : "text-[var(--bb-text-muted)] hover:text-[var(--bb-text-secondary)]"
              }`}
            >
              Create account
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label
                  htmlFor="login-name"
                  className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
                >
                  Name
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
                  className="w-full rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] px-3.5 py-2.5 text-sm text-[var(--bb-secondary)] outline-none placeholder:text-[var(--bb-text-muted)] focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)]"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="login-email"
                className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
              >
                Email <span className="text-[var(--bb-primary)]">*</span>
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
                aria-describedby={error ? "login-error" : undefined}
                className="w-full rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] px-3.5 py-2.5 text-sm text-[var(--bb-secondary)] outline-none placeholder:text-[var(--bb-text-muted)] focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)]"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
              >
                Password <span className="text-[var(--bb-primary)]">*</span>
              </label>
              <PasswordInput
                id="login-password"
                value={password}
                onChange={(e) => {
                  if (error) setError(null);
                  setPassword(e.target.value);
                }}
                placeholder={mode === "signup" ? "At least 12 characters" : "Your password"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                aria-describedby={
                  error ? "login-error" : mode === "signup" ? "login-password-rules" : undefined
                }
              />
              {mode === "signup" && (
                <PasswordRulesChecklist id="login-password-rules" password={password} />
              )}
              {mode === "signin" && (
                <Link
                  href="/reset-password"
                  className="mt-1 block text-right text-xs font-medium text-[var(--bb-primary)] hover:underline"
                >
                  Forgot password?
                </Link>
              )}
            </div>

            {/* Cloudflare Turnstile — anti-bot challenge on signup only.
                "Managed" mode means most humans see nothing (invisible);
                bots and suspicious traffic get an interactive challenge.
                We only render this when the site key is configured —
                local dev/CI without Cloudflare keeps working. */}
            {mode === "signup" && turnstileSiteKey && (
              <div className="flex justify-center pt-1">
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
              <p
                id="login-error"
                role="alert"
                className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600 dark:bg-red-900/20 dark:text-red-400"
              >
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={status === "submitting"}
              className="w-full rounded-xl bg-[var(--bb-primary)] px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {status === "submitting"
                ? "Please wait..."
                : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
            </button>

            {mode === "signup" && (
              <p className="pt-1 text-center text-[11px] text-[var(--bb-text-muted)]">
                By creating an account you agree to our{" "}
                <Link
                  href="/terms"
                  className="font-medium text-[var(--bb-text-secondary)] hover:underline"
                >
                  Terms
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  className="font-medium text-[var(--bb-text-secondary)] hover:underline"
                >
                  Privacy Policy
                </Link>
                .
              </p>
            )}
          </form>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--bb-border)]" />
            <span className="text-xs text-[var(--bb-text-muted)]">or</span>
            <div className="h-px flex-1 bg-[var(--bb-border)]" />
          </div>

          {/* Magic link */}
          <button
            onClick={handleMagicLink}
            disabled={status === "submitting"}
            className="w-full rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] px-6 py-2.5 text-sm font-semibold text-[var(--bb-secondary)] transition-colors hover:bg-[var(--bb-bg-page)] disabled:opacity-50"
          >
            Send magic link
          </button>
          <p className="mt-2 text-center text-xs text-[var(--bb-text-tertiary)]">
            No password needed — we&apos;ll email you a sign-in link.
          </p>

          {/* Demo mode link */}
          {isDemoMode && (
            <div className="mt-6 border-t border-[var(--bb-border-subtle)] pt-4 text-center">
              <a
                href="/debug/demo-user"
                className="text-xs font-medium text-[var(--bb-primary)] hover:underline"
              >
                Use demo personas instead
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Live password-policy checklist shown below the sign-up password field.
 * Each bullet turns green when its rule passes. Uses `useMemo` so the
 * test callbacks run once per keystroke rather than on every re-render.
 */
function PasswordRulesChecklist({ id, password }: { id: string; password: string }) {
  const results = useMemo(
    () => PASSWORD_POLICY_BULLETS.map((rule) => ({ ...rule, passed: rule.test(password) })),
    [password],
  );
  return (
    <ul
      id={id}
      className="mt-2 space-y-0.5 text-[11px] text-[var(--bb-text-secondary)]"
      aria-label="Password requirements"
    >
      {results.map((rule) => (
        <li key={rule.key} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
              rule.passed
                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                : "bg-[var(--bb-bg-card-muted)] text-[var(--bb-text-tertiary)]"
            }`}
          >
            {rule.passed ? "\u2713" : "\u2022"}
          </span>
          <span className={rule.passed ? "text-[var(--bb-text-secondary)]" : ""}>{rule.label}</span>
        </li>
      ))}
    </ul>
  );
}
