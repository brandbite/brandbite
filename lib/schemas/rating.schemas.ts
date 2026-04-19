// -----------------------------------------------------------------------------
// @file: lib/schemas/rating.schemas.ts
// @purpose: Zod schemas for creative-rating submit + aggregate query params.
// -----------------------------------------------------------------------------

import { z } from "zod";

const starScore = z.number().int().min(1).max(5);

export const submitRatingSchema = z.object({
  quality: starScore,
  communication: starScore,
  speed: starScore,
  feedback: z
    .string()
    .trim()
    .max(2000, "Feedback is too long (max 2000 characters)")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type SubmitRatingInput = z.infer<typeof submitRatingSchema>;
