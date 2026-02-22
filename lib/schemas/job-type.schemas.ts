import { z } from "zod";

export const createJobTypeSchema = z.object({
  name: z.string().trim().min(1, "Job type name is required"),
  category: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .default(null),
  categoryId: z.string().nullable().optional().default(null),
  description: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .default(null),
  estimatedHours: z.coerce
    .number()
    .int()
    .positive("estimatedHours must be a positive integer")
    .finite(),
  isActive: z.boolean().optional().default(true),
  hasQuantity: z.boolean().optional().default(false),
  quantityLabel: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .default(null),
  defaultQuantity: z.coerce.number().int().min(1).optional().default(1),
});

export const updateJobTypeSchema = z.object({
  id: z.string().min(1, "Job type id is required"),
  name: z.string().trim().min(1, "Job type name cannot be empty").optional(),
  category: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  categoryId: z.string().nullable().optional(),
  description: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  estimatedHours: z.coerce
    .number()
    .int()
    .positive("estimatedHours must be a positive integer")
    .finite()
    .optional(),
  isActive: z.boolean().optional(),
  hasQuantity: z.boolean().optional(),
  quantityLabel: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  defaultQuantity: z.coerce.number().int().min(1).optional(),
});

export type CreateJobTypeInput = z.infer<typeof createJobTypeSchema>;
export type UpdateJobTypeInput = z.infer<typeof updateJobTypeSchema>;
