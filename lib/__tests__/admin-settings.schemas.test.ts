// -----------------------------------------------------------------------------
// @file: lib/__tests__/admin-settings.schemas.test.ts
// @purpose: Per-key validation of admin settings — money settings must be
//           real positive whole numbers, switches true/false, AI mode one of
//           off/test/on.
// -----------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import {
  OWNER_ONLY_SETTING_KEYS,
  updateAdminSettingSchema,
} from "../schemas/admin-settings.schemas";

const ok = (key: string, value: string) =>
  updateAdminSettingSchema.safeParse({ key, value }).success;

describe("updateAdminSettingSchema", () => {
  it("accepts positive whole token amounts", () => {
    expect(ok("MIN_WITHDRAWAL_TOKENS", "20")).toBe(true);
    expect(ok("AUTO_PAYOUT_THRESHOLD_TOKENS", "1000000")).toBe(true);
  });

  it.each(["0", "-5", "abc", "1.5", "1000001"])("rejects %s as a token amount", (value) => {
    expect(ok("MIN_WITHDRAWAL_TOKENS", value)).toBe(false);
    expect(ok("AUTO_PAYOUT_THRESHOLD_TOKENS", value)).toBe(false);
  });

  it("only accepts true/false for switches", () => {
    expect(ok("TAGS_ENABLED", "true")).toBe(true);
    expect(ok("AUTO_PAYOUT_ENABLED", "false")).toBe(true);
    expect(ok("TALENT_APPLICATIONS_OPEN", "yes")).toBe(false);
  });

  it("only accepts off/on for AI ticket mode", () => {
    expect(ok("AI_TICKETS_MODE", "on")).toBe(true);
    expect(ok("AI_TICKETS_MODE", "test")).toBe(false);
    expect(ok("AI_TICKETS_MODE", "maybe")).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(ok("SOMETHING_ELSE", "true")).toBe(false);
  });
});

describe("OWNER_ONLY_SETTING_KEYS", () => {
  it("covers the settings that move money", () => {
    expect([...OWNER_ONLY_SETTING_KEYS].sort()).toEqual([
      "AUTO_PAYOUT_ENABLED",
      "AUTO_PAYOUT_THRESHOLD_TOKENS",
      "MIN_WITHDRAWAL_TOKENS",
    ]);
  });
});
