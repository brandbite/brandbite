// -----------------------------------------------------------------------------
// @file: components/admin/mfa-challenge-modal.tsx
// @purpose: Email-code second-factor modal for money-moving admin actions
//           (Security Precaution Plan — L4). Opens when a money-action POST
//           returns 202 { requiresMfa: true, challengeId, maskedEmail }.
//
//           Flow inside the modal:
//             1. User types the 6-digit code from their email
//             2. Submit → POST /api/admin/mfa/verify { challengeId, code }
//             3. On 200, call onVerified() — the parent retries the
//                original action and closes this modal
//             4. On 400, surface the error (wrong code, attempts remaining,
//                expired, etc.) and let the user try again
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useId, useState } from "react";

import { Button, Callout, Field, TextInput } from "@/components/admin/v2/ui";
import { Modal, ModalFooter, ModalHeader } from "@/components/ui/modal";

export type MfaChallengeInfo = {
  /** Delivery method selected by the server based on enrolment state. */
  method?: "email" | "totp";
  /** Present for method="email"; absent for TOTP (no code sent server-side). */
  challengeId?: string;
  maskedEmail?: string;
  expiresAt?: string;
  actionTag?: string;
};

type MfaChallengeModalProps = {
  open: boolean;
  challenge: MfaChallengeInfo | null;
  onClose: () => void;
  /** Fires after a successful /api/admin/mfa/verify call — parent retries. */
  onVerified: () => Promise<void> | void;
};

export function MfaChallengeModal({
  open,
  challenge,
  onClose,
  onVerified,
}: MfaChallengeModalProps) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputId = useId();

  useEffect(() => {
    if (open) {
      setCode("");
      setErrorMessage(null);
    }
  }, [open]);

  const canSubmit = code.trim().length === 6 && /^\d{6}$/.test(code.trim()) && !submitting;
  const method = challenge?.method === "totp" ? "totp" : "email";

  const handleSubmit = async () => {
    if (!challenge || !canSubmit) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const body =
        method === "totp"
          ? {
              method: "totp",
              code: code.trim(),
              actionTag: challenge.actionTag,
            }
          : {
              method: "email",
              challengeId: challenge.challengeId,
              code: code.trim(),
            };
      const res = await fetch("/api/admin/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(json?.error || "Verification failed.");
      }
      await onVerified();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? () => {} : onClose}
      size="sm"
      className="border border-[var(--av2-border)]"
    >
      <ModalHeader title="Security check" onClose={submitting ? () => {} : onClose} />
      <div className="space-y-4 text-sm text-[var(--av2-text-2)]">
        {method === "totp" ? (
          <p>
            Open your authenticator app (Authy, Google Authenticator, 1Password, etc.) and enter the
            6-digit code it&apos;s currently showing to confirm this money-moving action.
          </p>
        ) : (
          <p>
            We emailed a 6-digit code to{" "}
            <strong className="font-semibold text-[var(--av2-text)]">
              {challenge?.maskedEmail ?? "your account email"}
            </strong>
            . Enter it below to confirm this money-moving action.
          </p>
        )}
        <Field
          htmlFor={inputId}
          label="Security code"
          hint={
            method === "totp"
              ? "Codes rotate every 30 seconds. After this check, further money actions in the next 30 minutes won\u2019t ask again."
              : "Codes expire in 10 minutes. After this check, further money actions in the next 30 minutes won\u2019t ask again."
          }
        >
          <TextInput
            id={inputId}
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
          <Callout tone="error" title="Verification failed">
            {errorMessage}
          </Callout>
        )}
      </div>
      <ModalFooter className="mt-6">
        <Button variant="ghost" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!canSubmit}
          aria-busy={submitting || undefined}
        >
          {submitting ? "Verifying…" : "Verify"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
