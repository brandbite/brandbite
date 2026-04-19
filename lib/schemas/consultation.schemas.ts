// -----------------------------------------------------------------------------
// @file: lib/schemas/consultation.schemas.ts
// @purpose: Zod schemas for consultation submit + admin schedule/cancel.
// -----------------------------------------------------------------------------

import { z } from "zod";

/** Customer-side create payload. */
export const createConsultationSchema = z.object({
  description: z
    .string()
    .trim()
    .min(10, "Tell us a bit more (at least 10 characters).")
    .max(4000, "Description is too long (max 4000 characters)."),
  /** Free-text preferred slots, one per line from the form. */
  preferredTimes: z
    .array(z.string().trim().min(1).max(200))
    .max(5, "Pick up to 5 preferred slots.")
    .optional(),
  timezone: z.string().trim().max(64).optional(),
});

export type CreateConsultationInput = z.infer<typeof createConsultationSchema>;

/** Admin schedule / update payload. scheduledAt + videoLink become required
 *  when transitioning to SCHEDULED; enforced at the route level. */
export const updateConsultationSchema = z
  .object({
    status: z.enum(["PENDING", "SCHEDULED", "COMPLETED", "CANCELED"]).optional(),
    scheduledAt: z
      .string()
      .datetime()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    videoLink: z
      .string()
      .url("Video link must be a valid URL.")
      .max(500)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    adminNotes: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: "Nothing to update." });

export type UpdateConsultationInput = z.infer<typeof updateConsultationSchema>;
