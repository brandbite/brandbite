import { z } from "zod";

// Single source of truth for admin-writable AppSetting keys. The settings
// route imports this for both GET filtering and PATCH validation — previously
// the route kept its own longer list while this enum lagged behind, so the
// TAGS_ENABLED / TALENT_APPLICATIONS_OPEN / ADMIN_EVENT_EMAILS_ENABLED toggles
// failed to save (PATCH rejected the key). Add new keys here only.
export const ADMIN_SETTING_KEYS = [
  "MIN_WITHDRAWAL_TOKENS",
  "AUTO_PAYOUT_ENABLED",
  "AUTO_PAYOUT_THRESHOLD_TOKENS",
  "TALENT_APPLICATIONS_OPEN",
  "ADMIN_EVENT_EMAILS_ENABLED",
  "TAGS_ENABLED",
  // AI ticket mode: "off" | "on". Default off — there's no working AI
  // generation API yet.
  "AI_TICKETS_MODE",
] as const;

export type AdminSettingKey = (typeof ADMIN_SETTING_KEYS)[number];

/** Settings that move money — owner-only, like other money actions (lib/roles.ts). */
export const OWNER_ONLY_SETTING_KEYS: ReadonlySet<AdminSettingKey> = new Set([
  "MIN_WITHDRAWAL_TOKENS",
  "AUTO_PAYOUT_ENABLED",
  "AUTO_PAYOUT_THRESHOLD_TOKENS",
]);

const BOOLEAN_KEYS: ReadonlySet<AdminSettingKey> = new Set([
  "AUTO_PAYOUT_ENABLED",
  "TALENT_APPLICATIONS_OPEN",
  "ADMIN_EVENT_EMAILS_ENABLED",
  "TAGS_ENABLED",
]);

const POSITIVE_INT_KEYS: ReadonlySet<AdminSettingKey> = new Set([
  "MIN_WITHDRAWAL_TOKENS",
  "AUTO_PAYOUT_THRESHOLD_TOKENS",
]);

// Values are validated per key on the server: previously any non-empty
// string was stored, so "0" removed the withdrawal minimum, "-5" silently
// stopped auto-payouts and "abc" fell back to the default without a word.
export const updateAdminSettingSchema = z
  .object({
    key: z.enum(ADMIN_SETTING_KEYS, {
      error: "Invalid or unknown setting key.",
    }),
    value: z.string().trim().min(1, "Setting value must be a non-empty string."),
  })
  .superRefine(({ key, value }, ctx) => {
    if (POSITIVE_INT_KEYS.has(key)) {
      const n = Number(value);
      if (!/^\d+$/.test(value) || !Number.isSafeInteger(n) || n < 1 || n > 1_000_000) {
        ctx.addIssue({
          code: "custom",
          path: ["value"],
          message: "Enter a whole number of tokens from 1 to 1,000,000.",
        });
      }
    } else if (BOOLEAN_KEYS.has(key)) {
      if (value !== "true" && value !== "false") {
        ctx.addIssue({ code: "custom", path: ["value"], message: "Value must be on or off." });
      }
    } else if (key === "AI_TICKETS_MODE") {
      if (!["off", "on"].includes(value)) {
        ctx.addIssue({
          code: "custom",
          path: ["value"],
          message: "AI request mode must be off or on.",
        });
      }
    }
  });

export type UpdateAdminSettingInput = z.infer<typeof updateAdminSettingSchema>;
