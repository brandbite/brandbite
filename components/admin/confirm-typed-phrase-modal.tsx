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
//               catch + surface them under the input as a v2 Callout.
//             - Styled with the admin design language v1 primitives; the
//               shared Modal shell picks up the v2 palette through the
//               `.bb-admin-v2` legacy-token bridge.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useId, useState } from "react";

import { Button, Callout, Field, TextInput } from "@/components/admin/v2/ui";
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

// Submit styling per severity. `enabled:` keeps the v2 disabled look until
// the phrase matches. Danger is a solid error fill (the only action in a
// dialog the admin explicitly opened); warning is the outlined danger
// button; primary is the brand fill.
const TONE_BUTTON: Record<
  NonNullable<ConfirmTypedPhraseModalProps["submitTone"]>,
  { variant: "primary" | "danger"; className?: string }
> = {
  danger: {
    variant: "primary",
    className: "enabled:bg-[var(--av2-error-text)] enabled:hover:brightness-110",
  },
  warning: { variant: "danger" },
  primary: { variant: "primary" },
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
  const inputId = useId();
  const tone = TONE_BUTTON[submitTone];

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
    <Modal
      open={open}
      onClose={submitting ? () => {} : onClose}
      size="md"
      className="border border-[var(--av2-border)]"
    >
      <ModalHeader title={title} onClose={submitting ? () => {} : onClose} />
      <div className="space-y-4 text-sm text-[var(--av2-text-2)]">
        {description}
        <Field
          htmlFor={inputId}
          label={
            <>
              Type{" "}
              <strong className="rounded bg-[var(--av2-bg)] px-1.5 py-0.5 font-mono font-semibold text-[var(--av2-text)]">
                {requiredPhrase}
              </strong>{" "}
              to confirm
            </>
          }
        >
          <TextInput
            id={inputId}
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
            className="font-mono"
          />
        </Field>
        {errorMessage && (
          <Callout tone="error" title="Action failed">
            {errorMessage}
          </Callout>
        )}
      </div>
      <ModalFooter className="mt-6">
        <Button variant="ghost" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant={tone.variant}
          onClick={handleSubmit}
          disabled={!canSubmit}
          aria-busy={submitting || undefined}
          className={tone.className}
        >
          {submitting ? "Working…" : submitLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
