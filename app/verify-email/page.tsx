// -----------------------------------------------------------------------------
// @file: app/verify-email/page.tsx
// @purpose: "Check your email" notice shown after sign-up and when a user
//           tries to sign in with an unverified account. Handles resend
//           via authClient.sendVerificationEmail().
// -----------------------------------------------------------------------------

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { mapAuthError, type AuthClientError } from "@/lib/auth-error-messages";

export default function VerifyEmailPage() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const reason = params.get("reason");

  const [resending, setResending] = useState(false);
  const [resentAt, setResentAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleResend = async () => {
    if (!email) {
      setError("No email address on file. Please sign in again.");
      return;
    }
    setResending(true);
    setError(null);
    try {
      // BetterAuth's typed auth client exposes this at runtime; the TS
      // surface depends on enabled plugins, so we call it through a loose
      // cast rather than add a dep on a typed helper.
      const client = authClient as unknown as {
        sendVerificationEmail?: (args: {
          email: string;
          callbackURL?: string;
        }) => Promise<{ error?: { message?: string } | null }>;
      };
      if (!client.sendVerificationEmail) {
        // Fallback — hit the BetterAuth endpoint directly.
        const res = await fetch("/api/auth/send-verification-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, callbackURL: "/login" }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          throw new Error(json?.error || `Resend failed (${res.status})`);
        }
      } else {
        const { error: sendErr } = await client.sendVerificationEmail({
          email,
          callbackURL: "/onboarding",
        });
        if (sendErr) {
          throw new Error(mapAuthError(sendErr as AuthClientError, "Could not resend the email."));
        }
      }
      setResentAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend the email.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] p-6 shadow-sm">
        <p className="text-[11px] font-bold tracking-[0.2em] text-[var(--bb-primary)] uppercase">
          {reason === "unverified" ? "Verify to continue" : "Check your email"}
        </p>
        <h1 className="font-brand mt-2 text-2xl font-bold tracking-tight text-[var(--bb-secondary)]">
          {reason === "unverified"
            ? "Your email isn't verified yet"
            : "We just sent you a verification link"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--bb-text-secondary)]">
          {email ? (
            <>
              Click the link we sent to <strong>{email}</strong> to confirm your address. Once
              verified, you&apos;ll be able to sign in.
            </>
          ) : (
            <>
              Click the link in your inbox to confirm your address. Once verified, you&apos;ll be
              able to sign in.
            </>
          )}
        </p>

        {error && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}

        {resentAt && (
          <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            Sent again. Give it a minute, and check spam if it still doesn&apos;t arrive.
          </p>
        )}

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || !email}
            className="rounded-full bg-[var(--bb-primary)] px-4 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-60"
          >
            {resending ? "Sending..." : "Resend verification email"}
          </button>
          <Link
            href="/login"
            className="text-xs font-medium text-[var(--bb-text-secondary)] hover:text-[var(--bb-secondary)] hover:underline"
          >
            Back to sign in
          </Link>
        </div>

        <p className="mt-8 text-[11px] text-[var(--bb-text-muted)]">
          Didn&apos;t get the email? Check spam, or{" "}
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="text-[var(--bb-primary)] hover:underline"
          >
            try a different address
          </button>
          .
        </p>
      </div>
    </div>
  );
}
