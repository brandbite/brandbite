// -----------------------------------------------------------------------------
// @file: lib/admin-confirmation.ts
// @purpose: Server-side enforcement of the typed-phrase confirmation for
//           money-moving admin actions (Security Precaution Plan — L2).
//
//           The UX safeguard lives in components/admin/confirm-typed-phrase-
//           modal.tsx; this module enforces the same phrase from the API
//           side so curl / scripts / replay attacks can't bypass it.
//
//           Case-insensitive and trim-tolerant. The phrase-match isn't
//           cryptographic — its purpose is "you typed the magic word so we
//           know you meant this action", not "prove you know a secret".
// -----------------------------------------------------------------------------

export type ConfirmationCheckResult = { ok: true } | { ok: false; error: string };

/**
 * Verify the caller-supplied confirmation phrase matches the expected one.
 * Accepts null / undefined (treats as a missing confirmation).
 */
export function checkConfirmationPhrase(
  received: string | null | undefined,
  expected: string,
): ConfirmationCheckResult {
  if (!received || typeof received !== "string") {
    return {
      ok: false,
      error: `Confirmation phrase is required. Type "${expected}" to confirm.`,
    };
  }
  if (received.trim().toLowerCase() !== expected.trim().toLowerCase()) {
    return {
      ok: false,
      error: `Confirmation phrase mismatch. Type "${expected}" exactly.`,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Canonical phrases. Keeping them as constants so the client + server agree
// without a duplicated string literal.
// ---------------------------------------------------------------------------

export const CONFIRMATION_PHRASES = {
  WITHDRAWAL_APPROVE: "APPROVE",
  WITHDRAWAL_MARK_PAID: "PAID",
  COMPANY_TOKEN_CREDIT: "GRANT",
  COMPANY_TOKEN_DEBIT: "DEBIT",
  USER_PROMOTE_TO_ADMIN: "PROMOTE",
} as const;

export type ConfirmationPhrase = (typeof CONFIRMATION_PHRASES)[keyof typeof CONFIRMATION_PHRASES];
