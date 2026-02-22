import { z } from "zod";

export const updateCustomerSettingsSchema = z.object({
  user: z
    .object({
      name: z.string().trim().min(1, "User name cannot be empty.").nullable().optional(),
    })
    .optional(),
  company: z
    .object({
      name: z.string().trim().min(2, "Company name must be at least 2 characters.").optional(),
      website: z
        .string()
        .trim()
        .transform((v) => (v === "" ? null : v))
        .nullable()
        .optional(),
    })
    .optional(),
});

export type UpdateCustomerSettingsInput = z.infer<typeof updateCustomerSettingsSchema>;
