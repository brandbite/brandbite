// -----------------------------------------------------------------------------
// @file: lib/schemas/consultation-settings.schemas.ts
// @purpose: Zod schema for admin PUT /api/admin/consultation-settings.
// -----------------------------------------------------------------------------

import { z } from "zod";

const dayOfWeek = z.number().int().min(0).max(6);
const hourOfDay = z.number().int().min(0).max(23);

export const updateConsultationSettingsSchema = z
  .object({
    enabled: z.boolean().optional(),
    tokenCost: z.number().int().min(0).max(100_000).optional(),
    durationMinutes: z.number().int().min(5).max(480).optional(),
    contactEmail: z
      .string()
      .trim()
      .email("Must be a valid email.")
      .max(200)
      .optional()
      .or(z.literal("").transform(() => null)),
    calendarIcsUrl: z
      .string()
      .trim()
      .url("Must be a valid URL.")
      .max(1000)
      .optional()
      .or(z.literal("").transform(() => null)),
    workingDays: z.array(dayOfWeek).min(1, "Pick at least one working day.").max(7).optional(),
    workingHourStart: hourOfDay.optional(),
    workingHourEnd: hourOfDay.optional(),
    minNoticeHours: z
      .number()
      .int()
      .min(0)
      .max(30 * 24)
      .optional(),
    maxBookingDays: z.number().int().min(1).max(365).optional(),
    companyTimezone: z
      .string()
      .trim()
      .max(64)
      .optional()
      .or(z.literal("").transform(() => null)),
    adminNotes: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .or(z.literal("").transform(() => null)),
  })
  .refine(
    (v) =>
      v.workingHourStart === undefined ||
      v.workingHourEnd === undefined ||
      v.workingHourStart < v.workingHourEnd,
    {
      message: "workingHourStart must be earlier than workingHourEnd.",
      path: ["workingHourEnd"],
    },
  );

export type UpdateConsultationSettingsInput = z.infer<typeof updateConsultationSettingsSchema>;
