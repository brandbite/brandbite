import { z } from "zod";
import { TicketPriority } from "@prisma/client";

export const createTicketSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().optional().default(""),
  projectId: z
    .string()
    .min(1)
    .nullable()
    .optional()
    .transform((v) => v || null),
  jobTypeId: z
    .string()
    .min(1)
    .nullable()
    .optional()
    .transform((v) => v || null),
  quantity: z.coerce.number().int().min(1).max(10).optional().default(1).catch(1),
  priority: z
    .string()
    .toUpperCase()
    .pipe(z.nativeEnum(TicketPriority).catch(TicketPriority.MEDIUM))
    .optional()
    .default("MEDIUM"),
  dueDate: z.preprocess(
    (val) => {
      if (val === null || val === undefined || val === "") return null;
      if (typeof val !== "string") return null;
      const d = new Date(val.trim());
      return Number.isNaN(d.getTime()) ? "INVALID" : d;
    },
    z
      .date({ error: "Invalid due date format." })
      .nullable()
      .refine(
        (v) => {
          if (v === null) return true;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return v >= today;
        },
        { message: "Due date cannot be in the past." },
      )
      .refine(
        (v) => {
          if (v === null) return true;
          const maxDate = new Date();
          maxDate.setFullYear(maxDate.getFullYear() + 2);
          return v <= maxDate;
        },
        { message: "Due date cannot be more than 2 years in the future." },
      ),
  ),
  tagIds: z.array(z.string().min(1)).max(5).optional().default([]),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
