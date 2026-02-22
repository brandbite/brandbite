import { z } from "zod";

const ALLOWED_KEYS = ["MIN_WITHDRAWAL_TOKENS"] as const;

export const updateAdminSettingSchema = z.object({
  key: z.enum(ALLOWED_KEYS, {
    error: "Invalid or unknown setting key.",
  }),
  value: z.string().trim().min(1, "Setting value must be a non-empty string."),
});

export type UpdateAdminSettingInput = z.infer<typeof updateAdminSettingSchema>;
