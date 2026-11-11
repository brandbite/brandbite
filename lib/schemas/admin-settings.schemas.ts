import { z } from "zod";

import { ENGAGEMENT_SETTING_KEYS } from "@/lib/engagement/switches";
import { SOUNDTRACK_SETTING_KEYS } from "@/lib/soundtrack/moods";
import { invalidSpotifyEntries } from "@/lib/soundtrack/spotify";

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
  // Engagement features (lib/engagement/switches.ts). All default off.
  ...ENGAGEMENT_SETTING_KEYS,
  // Spotify playlist links per mood for the creatives' focus playlist.
  ...SOUNDTRACK_SETTING_KEYS,
] as const;

export type AdminSettingKey = (typeof ADMIN_SETTING_KEYS)[number];

/** Owner-only settings: the ones that move money (lib/roles.ts) and the engagement switches. */
export const OWNER_ONLY_SETTING_KEYS: ReadonlySet<AdminSettingKey> = new Set([
  "MIN_WITHDRAWAL_TOKENS",
  "AUTO_PAYOUT_ENABLED",
  "AUTO_PAYOUT_THRESHOLD_TOKENS",
  // Which engagement features run is the site owner's call.
  ...ENGAGEMENT_SETTING_KEYS,
  ...SOUNDTRACK_SETTING_KEYS,
]);

const BOOLEAN_KEYS: ReadonlySet<AdminSettingKey> = new Set([
  "AUTO_PAYOUT_ENABLED",
  "TALENT_APPLICATIONS_OPEN",
  "ADMIN_EVENT_EMAILS_ENABLED",
  "TAGS_ENABLED",
  ...ENGAGEMENT_SETTING_KEYS,
]);

const SOUNDTRACK_KEYS: ReadonlySet<string> = new Set(SOUNDTRACK_SETTING_KEYS);

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
    value: z.string().trim(),
  })
  .superRefine(({ key, value }, ctx) => {
    if (SOUNDTRACK_KEYS.has(key)) {
      // Empty is allowed: it clears the mood's playlists.
      const bad = invalidSpotifyEntries(value);
      if (bad.length > 0) {
        ctx.addIssue({
          code: "custom",
          path: ["value"],
          message: `Not a Spotify playlist or album link: ${bad[0]}`,
        });
      }
      return;
    }
    if (value.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "Setting value must be a non-empty string.",
      });
      return;
    }
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
