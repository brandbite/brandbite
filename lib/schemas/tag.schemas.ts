import { z } from "zod";
import { TAG_COLOR_KEYS, type TagColorKey } from "@/lib/tag-colors";

const tagColorEnum = z.enum(TAG_COLOR_KEYS as [TagColorKey, ...TagColorKey[]]);

export const createTagSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Tag name must be 1-30 characters.")
    .max(30, "Tag name must be 1-30 characters."),
  color: tagColorEnum.optional().default("GRAY"),
});

export const updateTagSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Tag name must be 1-30 characters.")
      .max(30, "Tag name must be 1-30 characters.")
      .optional(),
    color: tagColorEnum.optional(),
  })
  .refine((d) => d.name !== undefined || d.color !== undefined, {
    message: "No fields to update.",
  });

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
