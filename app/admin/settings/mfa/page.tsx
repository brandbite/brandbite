// -----------------------------------------------------------------------------
// @file: app/admin/settings/mfa/page.tsx
// @purpose: SITE_OWNER-only page to enrol / disable TOTP as the second factor
//           for money-moving admin actions (Security Plan — L4 TOTP upgrade).
//
//           Flow:
//             - Page load → GET /api/admin/mfa/enroll → receive a pending
//               secret + QR data URL. Secret NOT yet persisted on the
//               server — scanning + confirming a code is required.
//             - User scans the QR with Authy / 1Password / Google
//               Authenticator, then types the current 6-digit code.
//             - Submit → POST /api/admin/mfa/enroll { secret, code }.
//             - On success the secret is stored on UserAccount; future
//               money actions will prompt for TOTP codes instead of
//               emailing codes.
//             - Disable button → DELETE /api/admin/mfa/enroll. Falls
//               back to email codes.
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useState } from "react";

import { OwnerOnlyBanner } from "@/components/admin/owner-only-banner";
import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { useToast } from "@/components/ui/toast-provider";

type EnrolmentSession = {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
  label: string;
  issuer: string;
};

type SessionResponse = {
  user?: {
    email?: string;
  } | null;
};

export default function AdminMfaSettingsPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [enrolled, setEnrolled] = useState<boolean | null>(null);
  const [session, setSession] = useState<EnrolmentSession | null>(null);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // ---------------------------------------------------------------------
  // Check whether the current user already has TOTP enrolled. We reuse
  // /api/session for the email and a custom probe for the flag — the
  // probe is cheap (a single UserAccount.totpEnrolledAt field would be
  // cleaner but /api/admin/mfa/enroll returns a fresh secret whether
  // enrolled or not, so we use a dedicated status route inline here).
  // For this page we just call GET /api/admin/mfa/enroll and detect
  // "already enrolled" via a follow-up fetch of the session record. To
  // keep this simple we infer from a separate helper.
  // ---------------------------------------------------------------------

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/mfa/status", { cache: "no-store" });
      if (!res.ok) {
        setEnrolled(false);
        return;
      }
      const json = (await res.json()) as { enrolled?: boolean };
      setEnrolled(Boolean(json.enrolled));
    } catch {
      setEnrolled(false);
    }
  }, []);

  const startEnrolment = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/admin/mfa/enroll", { cache: "no-store" });
      const json = (await res.json()) as (EnrolmentSession & { error?: string }) | null;
      if (!res.ok || !json) {
        throw new Error(json?.error || "Failed to start enrolment.");
      }
      setSession(json);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to start enrolment.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sessionRes = await fetch("/api/session", { cache: "no-store" });
        if (sessionRes.ok) {
          const sessionJson = (await sessionRes.json()) as SessionResponse;
          if (!cancelled && sessionJson.user?.email) setUserEmail(sessionJson.user.email);
        }
      } catch {
        // best-effort
      }
      if (!cancelled) await checkStatus();
    })();
    return () => {
      cancelled = true;
    };
  }, [checkStatus]);

  // When status comes back "not enrolled" we eagerly fetch the enrolment
  // session so the QR is ready as soon as the user arrives at the page.
  useEffect(() => {
    if (enrolled === false && !session) {
      void startEnrolment();
    } else if (enrolled === true) {
      setLoading(false);
    }
  }, [enrolled, session, startEnrolment]);

  const handleConfirm = async () => {
    if (!session) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/admin/mfa/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: session.secret, code: code.trim() }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(json?.error || "Failed to enrol.");
      }
      showToast({
        type: "success",
        title: "TOTP enabled",
        description:
          "Future money actions will ask for a 6-digit code from your authenticator app.",
      });
      setEnrolled(true);
      setSession(null);
      setCode("");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to enrol.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisable = async () => {
    if (!window.confirm("Disable TOTP? Future money actions will email codes instead.")) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/admin/mfa/enroll", { method: "DELETE" });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error || "Failed to disable TOTP.");
      }
      showToast({
        type: "success",
        title: "TOTP disabled",
        description: "Future money actions will email codes instead.",
      });
      setEnrolled(false);
      setSession(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to disable TOTP.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Two-factor authentication</h1>
        <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">
          Add a one-tap authenticator code to money-moving admin actions. Replaces the slower
          &ldquo;wait for email&rdquo; flow with an instant 6-digit code from Authy, Google
          Authenticator, or 1Password.
        </p>
      </div>

      <OwnerOnlyBanner action="manage their own authenticator app" />

      {loading ? (
        <LoadingState message="Loading…" />
      ) : enrolled ? (
        <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] p-6 shadow-sm">
          <div className="mb-4 flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--bb-success-bg)] text-[var(--bb-success-text)]">
              ✓
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--bb-secondary)]">
                Authenticator app enabled
              </h2>
              <p className="mt-1 text-xs text-[var(--bb-text-secondary)]">
                {userEmail ? (
                  <>
                    Money actions on <strong>{userEmail}</strong> will prompt for a 6-digit code
                    from your authenticator app instead of an email.
                  </>
                ) : (
                  "Money actions will prompt for a code from your authenticator app."
                )}
              </p>
            </div>
          </div>

          {errorMessage && (
            <InlineAlert variant="error" size="sm" className="mb-3">
              {errorMessage}
            </InlineAlert>
          )}

          <Button
            variant="ghost"
            onClick={handleDisable}
            loading={submitting}
            loadingText="Disabling…"
            className="!border !border-red-300 !text-red-700 hover:!bg-red-50"
          >
            Disable authenticator app
          </Button>
        </div>
      ) : session ? (
        <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] p-6 shadow-sm">
          <div className="grid gap-6 md:grid-cols-[200px_1fr]">
            <div>
              {/* QR — next/image won't fetch a data: URL; use a plain img */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={session.qrDataUrl}
                alt="TOTP enrolment QR code"
                width={200}
                height={200}
                className="rounded-lg border border-[var(--bb-border)] bg-white p-2"
              />
              <p className="mt-2 text-[10px] text-[var(--bb-text-tertiary)]">
                Scan with Authy, 1Password, Google Authenticator, etc.
              </p>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--bb-secondary)]">
                Step 1 · Scan the QR code
              </h2>
              <p className="mt-1 text-xs text-[var(--bb-text-secondary)]">
                Or enter this secret manually in your authenticator:
              </p>
              <p className="mt-1 rounded-md border border-[var(--bb-border-input)] bg-[var(--bb-bg-warm)] px-2 py-1 font-mono text-[11px] tracking-wider text-[var(--bb-secondary)] select-all">
                {session.secret}
              </p>

              <div className="mt-5">
                <h2 className="text-sm font-semibold text-[var(--bb-secondary)]">
                  Step 2 · Confirm a code
                </h2>
                <p className="mt-1 text-xs text-[var(--bb-text-secondary)]">
                  Type the 6-digit code your app is showing right now. We verify it matches before
                  turning TOTP on.
                </p>
                <div className="mt-2 max-w-[200px]">
                  <FormInput
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    disabled={submitting}
                    className="!text-center !font-mono !text-lg !tracking-[0.5em]"
                  />
                </div>
                {errorMessage && (
                  <InlineAlert variant="error" size="sm" className="mt-2">
                    {errorMessage}
                  </InlineAlert>
                )}

                <div className="mt-3 flex gap-2">
                  <Button
                    variant="primary"
                    onClick={handleConfirm}
                    loading={submitting}
                    loadingText="Verifying…"
                    disabled={submitting || code.length !== 6}
                  >
                    Turn on
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSession(null);
                      setCode("");
                      setErrorMessage(null);
                      void startEnrolment();
                    }}
                    disabled={submitting}
                  >
                    Generate new code
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-page)] p-6 text-center shadow-sm">
          <p className="text-sm text-[var(--bb-text-secondary)]">Loading enrolment…</p>
        </div>
      )}
    </>
  );
}
