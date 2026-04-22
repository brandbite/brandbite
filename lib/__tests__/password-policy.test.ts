// -----------------------------------------------------------------------------
// @file: lib/__tests__/password-policy.test.ts
// @purpose: Regression suite for validatePasswordStrength. The same policy
//           is enforced both client-side (login + reset-password pages) and
//           server-side (BetterAuth before-hook), so a drift in either
//           direction is a user-facing bug.
// -----------------------------------------------------------------------------

import { describe, it, expect } from "vitest";

import {
  PASSWORD_POLICY,
  PASSWORD_POLICY_BULLETS,
  validatePasswordStrength,
} from "../password-policy";

describe("PASSWORD_POLICY constants", () => {
  it("requires at least 12 characters — longer than BetterAuth's default of 8", () => {
    expect(PASSWORD_POLICY.minLength).toBe(12);
  });

  it("exposes every active rule in PASSWORD_POLICY_BULLETS for UI rendering", () => {
    // If a rule is added to validatePasswordStrength without updating this
    // array, the checklist in the UI goes stale. Catch the drift here.
    expect(PASSWORD_POLICY_BULLETS.map((r) => r.key).sort()).toEqual([
      "digit",
      "length",
      "lower",
      "symbol",
      "upper",
    ]);
  });
});

describe("validatePasswordStrength — rejections", () => {
  it("rejects an empty string", () => {
    const r = validatePasswordStrength("");
    expect(r.ok).toBe(false);
  });

  it("rejects a short password that has every character class", () => {
    // 11 chars, has upper/lower/digit/symbol but still too short
    const r = validatePasswordStrength("Aa1!Aa1!Aa1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.toLowerCase()).toContain("12 characters");
  });

  it("rejects a long password with no uppercase", () => {
    const r = validatePasswordStrength("lowercase-only-1!");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.toLowerCase()).toContain("uppercase");
  });

  it("rejects a long password with no lowercase", () => {
    const r = validatePasswordStrength("UPPERCASE-ONLY-1!");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.toLowerCase()).toContain("lowercase");
  });

  it("rejects a long password with no digit", () => {
    const r = validatePasswordStrength("NoDigits!Here!!");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.toLowerCase()).toContain("number");
  });

  it("rejects a long password with no symbol", () => {
    const r = validatePasswordStrength("NoSymbolsHere123");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.toLowerCase()).toContain("symbol");
  });

  it("whitespace alone does not count as a symbol", () => {
    // 12+ chars with upper/lower/digit and spaces but no symbol.
    const r = validatePasswordStrength("Spaces Only 1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.toLowerCase()).toContain("symbol");
  });
});

describe("validatePasswordStrength — acceptances", () => {
  it("accepts a minimum-length password with all four classes", () => {
    const r = validatePasswordStrength("Abcdefg1234!");
    expect(r.ok).toBe(true);
  });

  it("accepts a passphrase-style password with spaces + symbol", () => {
    const r = validatePasswordStrength("my dog Is cool 1!");
    expect(r.ok).toBe(true);
  });

  it("accepts any printable punctuation as the symbol", () => {
    for (const sym of ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")", "-", "_", "+", "="]) {
      const r = validatePasswordStrength(`StrongPass123${sym}`);
      expect(r.ok).toBe(true);
    }
  });
});
