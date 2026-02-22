// -----------------------------------------------------------------------------
// @file: app/reset-password/page.tsx
// @purpose: Forgot password + reset password page (dual-purpose based on ?token)
// -----------------------------------------------------------------------------

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type Status = "idle" | "submitting" | "sent" | "reset-success" | "error";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const tokenError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<Status>(tokenError ? "error" : "idle");
  const [error, setError] = useState<string | null>(
    tokenError === "INVALID_TOKEN" ? "This reset link is invalid or has expired." : null,
  );

  // ---------------------------------------------------------------------------
  // Request password reset (no token — initial form)
  // ---------------------------------------------------------------------------

  async function handleRequestReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    setStatus("submitting");

    try {
      const res = await fetch("/api/auth/forget-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          redirectTo: "/reset-password",
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.message || "Failed to send reset link.");
        setStatus("error");
        return;
      }

      setStatus("sent");
    } catch {
      setError("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  // ---------------------------------------------------------------------------
  // Set new password (has token from email link)
  // ---------------------------------------------------------------------------

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!newPassword) {
      setError("Password is required.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setStatus("submitting");

    try {
      const { error: resetError } = await authClient.resetPassword({
        newPassword,
        token: token!,
      });

      if (resetError) {
        setError(resetError.message || "Failed to reset password.");
        setStatus("error");
        return;
      }

      setStatus("reset-success");
    } catch {
      setError("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  // ---------------------------------------------------------------------------
  // Success after password reset
  // ---------------------------------------------------------------------------

  if (status === "reset-success") {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--bb-bg-page)]">
        <header className="flex items-center border-b border-[var(--bb-border-subtle)] px-6 py-4">
          <Link href="/" className="text-lg font-bold text-[var(--bb-secondary)]">
            <span className="text-[var(--bb-primary)]">b</span>randbite
          </Link>
        </header>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6">
          <div className="w-full rounded-2xl border border-[var(--bb-border-subtle)] bg-[var(--bb-bg-card)] p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-6 w-6 text-green-600 dark:text-green-400"
              >
                <path
                  fillRule="evenodd"
                  d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[var(--bb-secondary)]">Password reset</h2>
            <p className="mt-2 text-sm text-[var(--bb-text-secondary)]">
              Your password has been updated successfully.
            </p>
            <button
              onClick={() => router.push("/login")}
              className="mt-6 rounded-xl bg-[var(--bb-primary)] px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Email sent confirmation
  // ---------------------------------------------------------------------------

  if (status === "sent") {
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
              If an account exists for{" "}
              <span className="font-medium text-[var(--bb-secondary)]">{email}</span>, we&apos;ve
              sent a password reset link.
            </p>
            <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
              The link expires in 1 hour.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block text-sm font-medium text-[var(--bb-primary)] hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main form: request reset OR set new password
  // ---------------------------------------------------------------------------

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bb-bg-page)]">
      <header className="flex items-center border-b border-[var(--bb-border-subtle)] px-6 py-4">
        <Link href="/" className="text-lg font-bold text-[var(--bb-secondary)]">
          <span className="text-[var(--bb-primary)]">b</span>randbite
        </Link>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6">
        <div className="w-full rounded-2xl border border-[var(--bb-border-subtle)] bg-[var(--bb-bg-card)] p-8 shadow-sm">
          <h2 className="mb-1 text-xl font-bold text-[var(--bb-secondary)]">
            {token ? "Set new password" : "Reset your password"}
          </h2>
          <p className="mb-6 text-sm text-[var(--bb-text-secondary)]">
            {token
              ? "Enter your new password below."
              : "Enter your email and we\u2019ll send you a reset link."}
          </p>

          {token ? (
            /* ---- New password form ---- */
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label
                  htmlFor="new-password"
                  className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
                >
                  New password <span className="text-[var(--bb-primary)]">*</span>
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] px-3.5 py-2.5 text-sm text-[var(--bb-secondary)] outline-none placeholder:text-[var(--bb-text-muted)] focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)]"
                />
              </div>
              <div>
                <label
                  htmlFor="confirm-password"
                  className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
                >
                  Confirm password <span className="text-[var(--bb-primary)]">*</span>
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] px-3.5 py-2.5 text-sm text-[var(--bb-secondary)] outline-none placeholder:text-[var(--bb-text-muted)] focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)]"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="w-full rounded-xl bg-[var(--bb-primary)] px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {status === "submitting" ? "Resetting..." : "Reset password"}
              </button>
            </form>
          ) : (
            /* ---- Email form ---- */
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div>
                <label
                  htmlFor="reset-email"
                  className="mb-1 block text-xs font-semibold text-[var(--bb-secondary)]"
                >
                  Email <span className="text-[var(--bb-primary)]">*</span>
                </label>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  className="w-full rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] px-3.5 py-2.5 text-sm text-[var(--bb-secondary)] outline-none placeholder:text-[var(--bb-text-muted)] focus:border-[var(--bb-primary)] focus:ring-1 focus:ring-[var(--bb-primary)]"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="w-full rounded-xl bg-[var(--bb-primary)] px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {status === "submitting" ? "Sending..." : "Send reset link"}
              </button>
            </form>
          )}

          <div className="mt-5 text-center">
            <Link
              href="/login"
              className="text-sm font-medium text-[var(--bb-primary)] hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
