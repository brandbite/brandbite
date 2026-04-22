// -----------------------------------------------------------------------------
// @file: components/auth/session-timeout-warning.tsx
// @purpose: WCAG 2.2.1 — "your session expires in 2 minutes" alertdialog with
//           a "Stay signed in" action that extends the session. Mounted by
//           every authenticated role layout; renders nothing until the
//           underlying hook flips to status="warning".
//
//           The rendering uses the shared Modal (which already implements
//           focus-trap + Esc-to-close + aria-labelled-by), but with
//           role="alertdialog" semantics reinforced via aria-live so screen
//           readers announce the warning as it appears — WCAG 2.2.1
//           explicitly calls out that the user must be *warned*, not just
//           shown silent UI.
// -----------------------------------------------------------------------------

"use client";

import { Button } from "@/components/ui/button";
import { Modal, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { useSessionTimeoutWarning } from "@/lib/hooks/use-session-timeout-warning";

function formatRemaining(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0 seconds";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const minPart = minutes > 0 ? `${minutes} minute${minutes === 1 ? "" : "s"}` : "";
  const secPart = seconds > 0 ? `${seconds} second${seconds === 1 ? "" : "s"}` : "";
  if (minPart && secPart) return `${minPart} ${secPart}`;
  return minPart || secPart;
}

export function SessionTimeoutWarning() {
  const { status, secondsRemaining, extend, dismiss } = useSessionTimeoutWarning();

  const isOpen = status === "warning" || status === "extending";
  const isExtending = status === "extending";

  return (
    <Modal open={isOpen} onClose={dismiss} size="sm">
      <ModalHeader title="Your session is about to expire" onClose={dismiss} />
      <div className="space-y-3 px-6 pb-4 text-sm text-[var(--bb-text-secondary)]">
        {/* aria-live ensures the countdown is re-announced as it changes.
            Using "polite" rather than "assertive" so it doesn't interrupt
            the user in the middle of typing. */}
        <p aria-live="polite" aria-atomic="true">
          You&apos;ll be signed out in <strong>{formatRemaining(secondsRemaining)}</strong> for
          security. Any unsaved changes may be lost.
        </p>
        <p className="text-[11px] text-[var(--bb-text-tertiary)]">
          Click <strong>Stay signed in</strong> to keep working.
        </p>
      </div>
      <ModalFooter>
        <Button variant="ghost" onClick={dismiss} disabled={isExtending}>
          Sign out
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            void extend();
          }}
          loading={isExtending}
          loadingText="Extending…"
          disabled={isExtending}
        >
          Stay signed in
        </Button>
      </ModalFooter>
    </Modal>
  );
}
