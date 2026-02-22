// -----------------------------------------------------------------------------
// @file: app/login/page.tsx
// @purpose: Combined sign-in / sign-up page with email+password and magic link.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-02-22
// -----------------------------------------------------------------------------

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type Mode = "signin" | "signup";
type Status = "idle" | "submitting" | "magic-link-sent" | "error";

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

  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

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
    if (mode === "signup" && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setStatus("submitting");

    try {
      if (mode === "signup") {
        const { error: signUpError } = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: name.trim() || email.trim().split("@")[0],
        });
        if (signUpError) {
          setError(signUpError.message || "Sign up failed.");
          setStatus("error");
          return;
        }
      } else {
        const { error: signInError } = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (signInError) {
          setError(signInError.message || "Invalid email or password.");
          setStatus("error");
          return;
        }
      }

      await handlePostLogin();
    } catch {
      setError("Something went wrong. Please try again.");
      setStatus("error");
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
        setError(mlError.message || "Failed to send magic link.");
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
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
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
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
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
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "Min. 8 characters" : "Your password"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                className="w-full rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] px-3.5 py-2.5 text-sm text-[var(--bb-secondary)] outline-none placeholder:text-[var(--bb-text-muted)] focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)]"
              />
              {mode === "signin" && (
                <Link
                  href="/reset-password"
                  className="mt-1 block text-right text-xs font-medium text-[var(--bb-primary)] hover:underline"
                >
                  Forgot password?
                </Link>
              )}
            </div>

            {/* Error message */}
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600 dark:bg-red-900/20 dark:text-red-400">
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
