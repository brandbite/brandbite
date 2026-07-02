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
  // AI ticket mode: "off" | "test" | "on". Default off — there's no working
  // AI generation API yet. "test" exposes the mode to site admins only.
  "AI_TICKETS_MODE",
] as const;

export type AdminSettingKey = (typeof ADMIN_SETTING_KEYS)[number];

export const updateAdminSettingSchema = z.object({
  key: z.enum(ADMIN_SETTING_KEYS, {
    error: "Invalid or unknown setting key.",
  }),
  value: z.string().trim().min(1, "Setting value must be a non-empty string."),
});

export type UpdateAdminSettingInput = z.infer<typeof updateAdminSettingSchema>;
