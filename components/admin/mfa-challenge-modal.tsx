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

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Modal, ModalFooter, ModalHeader } from "@/components/ui/modal";

export type MfaChallengeInfo = {
  challengeId: string;
  maskedEmail?: string;
  expiresAt?: string;
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

  useEffect(() => {
    if (open) {
      setCode("");
      setErrorMessage(null);
    }
  }, [open]);

  const canSubmit = code.trim().length === 6 && /^\d{6}$/.test(code.trim()) && !submitting;

  const handleSubmit = async () => {
    if (!challenge || !canSubmit) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/admin/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: challenge.challengeId, code: code.trim() }),
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
    <Modal open={open} onClose={submitting ? () => {} : onClose} size="sm">
      <ModalHeader title="Security check" onClose={submitting ? () => {} : onClose} />
      <div className="space-y-3 px-6 pb-4 text-sm text-[var(--bb-text-secondary)]">
        <p>
          We emailed a 6-digit code to{" "}
          <strong>{challenge?.maskedEmail ?? "your account email"}</strong>. Enter it below to
          confirm this money-moving action.
        </p>
        <p className="text-[11px] text-[var(--bb-text-tertiary)]">
          Codes expire in 10 minutes. After this check, further money actions in the next 30 minutes
          won&apos;t ask again.
        </p>
        <FormInput
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="123456"
          disabled={submitting}
          aria-label="Security code"
          className="!text-center !font-mono !text-lg !tracking-[0.5em]"
        />
        {errorMessage && (
          <InlineAlert variant="error" size="sm">
            {errorMessage}
          </InlineAlert>
        )}
      </div>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          loading={submitting}
          loadingText="Verifying…"
          disabled={!canSubmit}
        >
          Verify
        </Button>
      </ModalFooter>
    </Modal>
  );
}
