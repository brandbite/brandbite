import { z } from "zod";
import { abbreviationSchema } from "@/lib/abbreviation";

export const createProjectSchema = z.object({
  name: z.string().trim().min(2, "Project name is required (min 2 characters)."),
  code: abbreviationSchema.optional(),
});

/** Empty string → null helper for brand-guide text fields — the UI submits an
 *  empty input when the customer clears the value. */
const optionalNullableString = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} is too long (max ${max} characters).`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const updateProjectSchema = z.object({
  name: z.string().trim().min(2, "Project name is required (min 2 characters).").optional(),
  code: abbreviationSchema.optional(),
  brandLogoUrl: z
    .string()
    .trim()
    .max(1000)
    .url("Brand logo must be a valid URL.")
    .transform((v) => v as string)
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  brandColors: optionalNullableString(500, "Brand colors"),
  brandFonts: optionalNullableString(500, "Brand fonts"),
  brandVoice: optionalNullableString(2000, "Brand voice / tone notes"),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
