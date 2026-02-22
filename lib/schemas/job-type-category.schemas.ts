import { z } from "zod";

export const createJobTypeCategorySchema = z.object({
  name: z.string().trim().min(2, "Category name is required (min 2 characters)."),
  slug: z.string().trim().optional().default(""),
  icon: z
    .string()
    .trim()
    .transform((v) => v || null)
    .nullable()
    .optional()
    .default(null),
  sortOrder: z.coerce.number().int().optional().default(0),
});

export type CreateJobTypeCategoryInput = z.infer<typeof createJobTypeCategorySchema>;
