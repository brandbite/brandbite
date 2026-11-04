// -----------------------------------------------------------------------------
// @file: components/dashboard/account/delete-account.tsx
// @purpose: Danger-zone card + typed-email confirmation for GDPR account
//           deletion, on the customer and creative settings screens.
// -----------------------------------------------------------------------------

"use client";

import { useState, type ReactNode } from "react";

import { Button, Callout, Card, TextInput } from "@/components/admin/v2/ui";
import { Modal, ModalFooter, ModalHeader } from "@/components/ui/modal";

export function DeleteAccountCard({
  endpoint,
  email,
  description,
}: {
  /** Role-specific endpoint wrapping lib/account-deletion. */
  endpoint: string;
  /** Null while unknown: the action stays disabled rather than guessing. */
  email: string | null;
  description: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!email) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to delete account.");
      // Full reload so no stale client state survives.
      window.location.href = "/login?deleted=1";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account.");
    } finally {
      setDeleting(false);
    }
  };

  const matches = !!email && confirmEmail.trim().toLowerCase() === email.toLowerCase();

  return (
    <>
      <Card className="border-[var(--av2-error)]/40">
        <h2 className="text-xl leading-7 font-semibold text-[var(--av2-error-text)]">
          Delete account
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-[var(--av2-text-2)]">{description}</p>
        <Button
          variant="danger"
          className="mt-4"
          disabled={!email}
          onClick={() => {
            setConfirmEmail("");
            setError(null);
            setOpen(true);
          }}
        >
          Delete my account
        </Button>
      </Card>

      {/* Typing the email is the "yes I meant it" safeguard. */}
      <Modal open={open} onClose={() => setOpen(false)} size="md">
        <ModalHeader title="Delete your account?" onClose={() => setOpen(false)} />
        <div className="space-y-3 px-6 pb-4 text-sm text-[var(--av2-text-2)]">
          <p>
            This is permanent. Your sign-in credentials are removed immediately. Historical tickets,
            ratings, and ledger entries are kept but <strong>anonymized</strong>.
          </p>
          <p>
            To confirm, type your account email: <strong>{email ?? ""}</strong>
          </p>
          <TextInput
            type="email"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder="Type your email to confirm"
            aria-label="Type your email to confirm deletion"
            disabled={deleting}
            // Don't let password managers autofill this.
            autoComplete="off"
          />
          {error && <Callout tone="error">{error}</Callout>}
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => void handleDelete()}
            disabled={deleting || !matches}
            aria-busy={deleting || undefined}
          >
            {deleting ? "Deleting…" : "Delete my account"}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
