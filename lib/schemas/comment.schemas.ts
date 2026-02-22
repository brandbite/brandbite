import { z } from "zod";

export const createCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Comment body is required")
    .max(2000, "Comment is too long (max 2000 characters)"),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
