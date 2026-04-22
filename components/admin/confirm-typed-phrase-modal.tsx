// -----------------------------------------------------------------------------
// @file: components/admin/confirm-typed-phrase-modal.tsx
// @purpose: Reusable "type X to confirm" modal for irreversible / money-moving
//           admin actions (Security Precaution Plan — L2). Catches confused-
//           deputy mistakes ("I meant to click the row above this one") by
//           forcing the admin to physically type a phrase. Not a defence
//           against a determined attacker — they'll just type the phrase —
//           but composes with L3 email receipts + L4 MFA to close the gap.
//
//           Design choices:
//             - No auto-focus on the input: `Modal` already focus-traps, but
//               we want the admin to READ the description before typing, so
//               forcing focus into the input would skip the most important
//               step (reading "you're about to approve $125 to alice@…").
//             - Case-insensitive comparison on the phrase match. The
//               "typed the right thing" check is UX, not cryptographic.
//             - `onSubmit` returns a Promise so the caller can show the
//               loading state on the submit button while the server call
//               is in flight. Errors bubble up via a thrown Error; we
//               catch + surface them under the input as InlineAlert.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/ui/form-field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Modal, ModalFooter, ModalHeader } from "@/components/ui/modal";

type ConfirmTypedPhraseModalProps = {
  open: boolean;
  onClose: () => void;
  /** Short title at the top of the modal ("Approve withdrawal?") */
  title: string;
  /** React node rendered above the input — the "what am I about to do?" copy. */
  description: React.ReactNode;
  /** The exact phrase the user must type (case-insensitive). */
  requiredPhrase: string;
  /** Label on the submit button. */
  submitLabel: string;
  /** Styling for the submit button — matches the severity of the action. */
  submitTone?: "danger" | "warning" | "primary";
  /** Called after the user has typed the phrase. Throw to surface an error. */
  onSubmit: () => Promise<void> | void;
};

const TONE_CLASSES: Record<NonNullable<ConfirmTypedPhraseModalProps["submitTone"]>, string> = {
  danger: "!bg-red-600 hover:!bg-red-700",
  warning: "!bg-amber-600 hover:!bg-amber-700",
  primary: "",
};

export function ConfirmTypedPhraseModal({
  open,
  onClose,
  title,
  description,
  requiredPhrase,
  submitLabel,
  submitTone = "primary",
  onSubmit,
}: ConfirmTypedPhraseModalProps) {
  const [typed, setTyped] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset the typed input + any prior error every time the modal opens.
  // Without this, re-opening after a cancel leaves the previous attempt.
  useEffect(() => {
    if (open) {
      setTyped("");
      setErrorMessage(null);
    }
  }, [open]);

  const phraseMatches = typed.trim().toLowerCase() === requiredPhrase.trim().toLowerCase();
  const canSubmit = phraseMatches && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await onSubmit();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={submitting ? () => {} : onClose} size="md">
      <ModalHeader title={title} onClose={submitting ? () => {} : onClose} />
      <div className="space-y-3 px-6 pb-4 text-sm text-[var(--bb-text-secondary)]">
        {description}
        <p className="text-[11px] text-[var(--bb-text-tertiary)]">
          Type <strong className="font-mono text-[var(--bb-secondary)]">{requiredPhrase}</strong> to
          confirm.
        </p>
        <FormInput
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={requiredPhrase}
          disabled={submitting}
          // Don't let password managers or clipboard suggestions autofill —
          // the physical typing step is the whole point.
          autoComplete="off"
          spellCheck={false}
          aria-label={`Type ${requiredPhrase} to confirm`}
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
          loadingText="Working…"
          disabled={!canSubmit}
          className={TONE_CLASSES[submitTone]}
        >
          {submitLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
