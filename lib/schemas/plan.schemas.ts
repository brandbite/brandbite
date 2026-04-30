import { z } from "zod";

/**
 * Reusable nullable-string transform: accepts a trimmed string, treats
 * empty as null. Used for every text-ish Plan field that's allowed to
 * be cleared via the admin form.
 */
const nullableTrimmedString = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable();

/**
 * Display-copy fields (PR 2 of the pricing rework). Optional on both
 * create and update — landing-page renderer falls back to placeholders
 * when null. `features` accepts either an array of strings (canonical
 * shape) or a newline-delimited textarea string (admin-friendly UX),
 * which we normalise into an array before persisting.
 */
const featuresInput = z
  .union([
    z.array(z.string().trim().min(1).max(200)),
    z.string().transform((v) =>
      v
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    ),
  ])
  .transform((arr) => (arr.length === 0 ? null : arr.slice(0, 12)))
  .nullable();

const displayCopyFields = {
  tagline: nullableTrimmedString.optional(),
  features: featuresInput.optional(),
  displayCtaLabel: nullableTrimmedString.optional(),
  displaySubtitle: nullableTrimmedString.optional(),
  displayOrder: z.number().int().min(0).max(1000).nullable().optional(),
};

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
  isRecurring: z.boolean().optional().default(true),
  stripeProductId: nullableTrimmedString.optional().default(null),
  stripePriceId: nullableTrimmedString.optional().default(null),
  ...displayCopyFields,
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
  isRecurring: z.boolean().optional(),
  stripeProductId: nullableTrimmedString.optional(),
  stripePriceId: nullableTrimmedString.optional(),
  ...displayCopyFields,
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
