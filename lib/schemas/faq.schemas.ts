// -----------------------------------------------------------------------------
// @file: lib/schemas/faq.schemas.ts
// @purpose: Zod schemas for the admin FAQ CRUD endpoints. Mirrors the limits
//           the public FaqBrowser renders against and the /admin/faq form
//           enforces client-side, so a payload that gets past the form is
//           guaranteed to be acceptable to the schema (and vice versa).
// -----------------------------------------------------------------------------

import { z } from "zod";

const trimmedNonEmpty = (max: number, label: string) =>
  z.string().trim().min(1, `${label} is required.`).max(max, `${label} is too long.`);

export const createFaqSchema = z.object({
  question: trimmedNonEmpty(300, "Question"),
  answer: trimmedNonEmpty(5000, "Answer"),
  category: trimmedNonEmpty(80, "Category"),
  /** Optional. Server falls back to `(max position in category) + 1` when
   *  omitted so callers can leave it out for new rows and the row lands at
   *  the end of its bucket without a separate API roundtrip. */
  position: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateFaqSchema = z.object({
  question: z.string().trim().min(1).max(300).optional(),
  answer: z.string().trim().min(1).max(5000).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  position: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

export type CreateFaqInput = z.infer<typeof createFaqSchema>;
export type UpdateFaqInput = z.infer<typeof updateFaqSchema>;
