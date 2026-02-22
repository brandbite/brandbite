import { z } from "zod";

export const createPayoutRuleSchema = z.object({
  name: z.string().trim().min(1, "Rule name is required"),
  description: z
    .string()
    .trim()
    .transform((v) => v || null)
    .nullable()
    .optional()
    .default(null),
  minCompletedTickets: z.coerce
    .number()
    .int()
    .min(1, "minCompletedTickets must be a positive integer"),
  timeWindowDays: z.coerce.number().int().min(1, "timeWindowDays must be a positive integer"),
  payoutPercent: z.coerce.number().int().min(1).max(100, "payoutPercent must be between 1 and 100"),
  priority: z.coerce.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const updatePayoutRuleSchema = z.object({
  id: z.string().min(1, "Payout rule id is required"),
  name: z.string().trim().min(1, "Rule name cannot be empty").optional(),
  description: z
    .string()
    .trim()
    .transform((v) => v || null)
    .nullable()
    .optional(),
  minCompletedTickets: z.coerce
    .number()
    .int()
    .min(1, "minCompletedTickets must be a positive integer")
    .optional(),
  timeWindowDays: z.coerce
    .number()
    .int()
    .min(1, "timeWindowDays must be a positive integer")
    .optional(),
  payoutPercent: z.coerce
    .number()
    .int()
    .min(1)
    .max(100, "payoutPercent must be between 1 and 100")
    .optional(),
  priority: z.coerce.number().int().optional(),
  isActive: z.boolean().optional(),
});

export type CreatePayoutRuleInput = z.infer<typeof createPayoutRuleSchema>;
export type UpdatePayoutRuleInput = z.infer<typeof updatePayoutRuleSchema>;
