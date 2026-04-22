// -----------------------------------------------------------------------------
// @file: lib/password-policy.ts
// @purpose: Shared password strength policy — used by BetterAuth's server-side
//           before-hook AND by the client-side sign-up / reset-password pages
//           so the rules are declared in one place and can't drift.
// -----------------------------------------------------------------------------

export const PASSWORD_POLICY = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSymbol: true,
} as const;

/** Human-readable list of every active requirement, in the order shown in
 *  the UI. Stays in sync with the checks below — add new rules here when
 *  you add them to `validatePasswordStrength`. */
export const PASSWORD_POLICY_BULLETS: ReadonlyArray<{
  key: string;
  label: string;
  test: (s: string) => boolean;
}> = [
  {
    key: "length",
    label: `At least ${PASSWORD_POLICY.minLength} characters`,
    test: (s) => s.length >= PASSWORD_POLICY.minLength,
  },
  {
    key: "upper",
    label: "An uppercase letter (A–Z)",
    test: (s) => /[A-Z]/.test(s),
  },
  {
    key: "lower",
    label: "A lowercase letter (a–z)",
    test: (s) => /[a-z]/.test(s),
  },
  {
    key: "digit",
    label: "A number (0–9)",
    test: (s) => /\d/.test(s),
  },
  {
    key: "symbol",
    label: "A symbol (e.g. ! @ # $ %)",
    // Anything that isn't a letter, digit, or whitespace counts.
    test: (s) => /[^A-Za-z0-9\s]/.test(s),
  },
];

export type PasswordCheckResult = { ok: true } | { ok: false; error: string };

/**
 * Validate a candidate password against the full policy. Returns a single
 * human-readable error describing *the first* failed requirement — that
 * keeps the sign-up form error compact. The client-side checklist
 * component shows all rules in parallel so users can see what's left.
 */
export function validatePasswordStrength(candidate: string): PasswordCheckResult {
  for (const rule of PASSWORD_POLICY_BULLETS) {
    if (!rule.test(candidate)) {
      return { ok: false, error: `Password must include: ${rule.label.toLowerCase()}.` };
    }
  }
  return { ok: true };
}
