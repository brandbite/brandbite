import { z } from "zod";

export const createPlanSchema = z.object({
  name: z.string().trim().min(1, "Plan name is required."),
  monthlyTokens: z.number().positive("Monthly tokens must be a positive number.").finite(),
  priceCents: z
    .number()
    .nonnegative("Price (cents) must be null or a non-negative number.")
    .finite()
    .nullable()
    .optional()
    .default(null),
  isActive: z.boolean().optional().default(true),
  stripeProductId: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .default(null),
  stripePriceId: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .default(null),
});

export const updatePlanSchema = z.object({
  id: z.string().min(1, "Plan id is required for update."),
  name: z.string().trim().min(1, "Plan name cannot be empty.").optional(),
  monthlyTokens: z
    .number()
    .positive("Monthly tokens must be a positive number when provided.")
    .finite()
    .optional(),
  priceCents: z
    .number()
    .nonnegative("Price (cents) must be null or a non-negative number.")
    .finite()
    .nullable()
    .optional(),
  isActive: z.boolean().optional(),
  stripeProductId: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  stripePriceId: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
