import { z } from "zod";

export const assignPlanSchema = z.object({
  companyId: z.string().min(1, "companyId is required"),
  planId: z
    .string()
    .min(1)
    .nullable()
    .optional()
    .transform((v) => v || null),
});

export type AssignPlanInput = z.infer<typeof assignPlanSchema>;
