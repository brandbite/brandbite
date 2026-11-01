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
import { IconCoins } from "@/components/admin/v2/icons";
import {
  Badge,
  Button,
  Callout,
  Card,
  Field,
  IconTile,
  PageHeader,
  Skeleton,
  TextInput,
} from "@/components/admin/v2/ui";
import { useToast } from "@/components/ui/toast-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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

  const [confirmDisable, setConfirmDisable] = useState(false);

  const handleDisable = async () => {
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
  // Header status: null while the status probe is in flight.
  const statusBadge =
    enrolled === null ? null : enrolled ? (
      <Badge tone="green" dot>
        Enabled
      </Badge>
    ) : (
      <Badge tone="neutral" dot>
        Not enrolled
      </Badge>
    );

  return (
    <>
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            Two-factor authentication
            <Badge tone="peach" className="font-medium tracking-normal">
              Site owner only
            </Badge>
          </span>
        }
        description="Confirm money-moving admin actions with an instant 6-digit code from Authy, Google Authenticator or 1Password, instead of waiting for an email."
        meta={
          statusBadge && (
            <span className="inline-flex items-center gap-2">Status {statusBadge}</span>
          )
        }
      />

      <OwnerOnlyBanner action="manage their own authenticator app" />

      <div className="space-y-6">
        {loading ? (
          <Card>
            <div aria-busy="true" aria-label="Loading two-factor status" className="space-y-4">
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-4 w-96 max-w-full" />
              <div className="grid gap-8 pt-2 md:grid-cols-2">
                <Skeleton className="h-52 w-52" />
                <Skeleton className="h-40" />
              </div>
            </div>
          </Card>
        ) : enrolled ? (
          <Card>
            <div className="flex flex-wrap items-start gap-4">
              <IconTile tone="green">
                <IconCheck />
              </IconTile>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl leading-7 font-semibold">Authenticator app enabled</h2>
                <p className="mt-1 text-sm text-[var(--av2-text-2)]">
                  {userEmail ? (
                    <>
                      Money actions on{" "}
                      <strong className="font-semibold text-[var(--av2-text)]">{userEmail}</strong>{" "}
                      will prompt for a 6-digit code from your authenticator app instead of an
                      email.
                    </>
                  ) : (
                    "Money actions will prompt for a code from your authenticator app."
                  )}
                </p>
              </div>
            </div>

            <div className="mt-6 border-t border-[var(--av2-border)] pt-5">
              <h3 className="text-base font-semibold">Disable authenticator app</h3>
              <p className="mt-1 text-sm text-[var(--av2-text-2)]">
                Money actions fall back to emailed codes. You can enrol again at any time.
              </p>
              {errorMessage && (
                <div className="mt-3">
                  <Callout tone="error" title="Couldn't disable two-factor">
                    {errorMessage}
                  </Callout>
                </div>
              )}
              <Button
                variant="danger"
                className="mt-4"
                onClick={() => setConfirmDisable(true)}
                disabled={submitting}
                aria-busy={submitting || undefined}
              >
                {submitting ? "Disabling…" : "Disable authenticator app"}
              </Button>
            </div>
          </Card>
        ) : session ? (
          <Card padding="none">
            <div className="grid md:grid-cols-2">
              {/* Step 1 — scan */}
              <section
                aria-labelledby="mfa-step-1"
                className="border-b border-[var(--av2-border)] p-6 md:border-r md:border-b-0"
              >
                <StepHeading
                  n={1}
                  tone="lavender"
                  id="mfa-step-1"
                  title="Connect your authenticator"
                  description="Scan the QR code with Authy, 1Password, Google Authenticator or similar."
                />
                <div className="mt-5 sm:pl-14">
                  {/* QR — next/image won't fetch a data: URL; use a plain img */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={session.qrDataUrl}
                    alt="TOTP enrolment QR code"
                    width={200}
                    height={200}
                    className="rounded-xl border border-[var(--av2-border)] bg-white p-2"
                  />
                  <details className="group mt-5 rounded-xl border border-[var(--av2-border)] bg-[var(--av2-bg)]">
                    <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                      <svg
                        aria-hidden="true"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="shrink-0 transition-transform group-open:rotate-90"
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                      Can&rsquo;t scan the code?
                    </summary>
                    <div className="px-4 pb-4">
                      <p className="text-sm text-[var(--av2-text-2)]">
                        Enter this secret manually in your authenticator:
                      </p>
                      <p className="mt-2 rounded-lg border border-[var(--av2-border)] bg-[var(--av2-surface)] px-3 py-2 font-mono text-sm tracking-wider break-all text-[var(--av2-text)] select-all">
                        {session.secret}
                      </p>
                    </div>
                  </details>
                </div>
              </section>

              {/* Step 2 — verify */}
              <section aria-labelledby="mfa-step-2" className="p-6">
                <StepHeading
                  n={2}
                  tone="peach"
                  id="mfa-step-2"
                  title="Verify the connection"
                  description="Type the 6-digit code your app is showing right now. We check it matches before turning two-factor on."
                />
                <div className="mt-5 sm:pl-14">
                  <Field label="6-digit code" htmlFor="mfa-code" className="max-w-[240px]">
                    <TextInput
                      id="mfa-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="123456"
                      disabled={submitting}
                      aria-invalid={errorMessage ? true : undefined}
                      className="h-12 text-center font-mono text-lg tracking-[0.5em]"
                    />
                  </Field>
                  {errorMessage && (
                    <div className="mt-3">
                      <Callout tone="error" title="Couldn't turn on two-factor">
                        {errorMessage}
                      </Callout>
                    </div>
                  )}
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <Button
                      variant="primary"
                      onClick={handleConfirm}
                      disabled={submitting || code.length !== 6}
                      aria-busy={submitting || undefined}
                    >
                      {submitting ? "Verifying…" : "Turn on two-factor"}
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
                  <p className="mt-4 text-sm text-[var(--av2-text-2)]">
                    Two-factor turns on only after your code is verified. Generating a new code
                    replaces the QR code.
                  </p>
                </div>
              </section>
            </div>
          </Card>
        ) : errorMessage ? (
          <Callout
            tone="error"
            title="Couldn't start enrolment"
            action={
              <Button size="sm" onClick={() => void startEnrolment()}>
                Try again
              </Button>
            }
          >
            {errorMessage}
          </Callout>
        ) : (
          <Card>
            <div aria-busy="true" className="space-y-3">
              <p className="text-sm text-[var(--av2-text-2)]">Loading enrolment…</p>
              <Skeleton className="h-40" />
            </div>
          </Card>
        )}

        <Card>
          <div className="flex items-start gap-4">
            <IconTile tone="green">
              <IconCoins />
            </IconTile>
            <div className="min-w-0">
              <h2 className="text-base font-semibold">Used for financial admin actions</h2>
              <p className="mt-1 text-sm text-[var(--av2-text-2)]">
                Money-moving admin actions, such as approving withdrawals, ask for this code.
                Without an authenticator app, those actions email you a code instead.
              </p>
            </div>
          </div>
        </Card>
      </div>
      <ConfirmDialog
        open={confirmDisable}
        onClose={() => !submitting && setConfirmDisable(false)}
        onConfirm={async () => {
          await handleDisable();
          setConfirmDisable(false);
        }}
        loading={submitting}
        variant="danger"
        title="Disable two-factor?"
        description="Future money actions will email codes instead of asking for your authenticator app."
        confirmLabel="Disable"
        cancelLabel="Keep it on"
      />
    </>
  );
}

function StepHeading({
  n,
  tone,
  id,
  title,
  description,
}: {
  n: number;
  tone: "lavender" | "peach";
  id: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <IconTile tone={tone} size={40} round>
        <span className="text-base font-bold">{n}</span>
      </IconTile>
      <div className="min-w-0">
        <h2 id={id} className="text-xl leading-7 font-semibold">
          <span className="sr-only">Step {n}: </span>
          {title}
        </h2>
        <p className="mt-1 text-sm text-[var(--av2-text-2)]">{description}</p>
      </div>
    </div>
  );
}

function IconCheck() {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
