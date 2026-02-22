import { z } from "zod";
import { TicketPriority } from "@prisma/client";

const allowedStatuses: [string, ...string[]] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];

export const updateTicketStatusSchema = z.object({
  status: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(
      z.enum(allowedStatuses, {
        error: "Invalid status. Allowed values: TODO, IN_PROGRESS, IN_REVIEW, DONE",
      }),
    ),
});

export const updateTicketFieldsSchema = z
  .object({
    title: z.string().trim().min(1, "Title cannot be empty").optional(),
    description: z
      .string()
      .trim()
      .transform((v) => v || null)
      .nullable()
      .optional(),
    priority: z
      .string()
      .toUpperCase()
      .pipe(z.nativeEnum(TicketPriority, { error: "Invalid priority" }))
      .optional(),
    dueDate: z.preprocess(
      (val) => {
        if (val === null || val === undefined || val === "") return null;
        if (typeof val !== "string") return null;
        const d = new Date(val.trim());
        return Number.isNaN(d.getTime()) ? "INVALID" : d;
      },
      z.date({ error: "Invalid due date" }).nullable().optional(),
    ),
    projectId: z
      .string()
      .min(1)
      .nullable()
      .optional()
      .transform((v) => (v === undefined ? undefined : v || null)),
    jobTypeId: z
      .string()
      .min(1)
      .nullable()
      .optional()
      .transform((v) => (v === undefined ? undefined : v || null)),
    tagIds: z.array(z.string().min(1)).max(5).optional(),
  })
  .refine(
    (d) =>
      d.title !== undefined ||
      d.description !== undefined ||
      d.priority !== undefined ||
      d.dueDate !== undefined ||
      d.projectId !== undefined ||
      d.jobTypeId !== undefined ||
      d.tagIds !== undefined,
    { message: "No valid fields to update" },
  );

export type UpdateTicketStatusInput = z.infer<typeof updateTicketStatusSchema>;
export type UpdateTicketFieldsInput = z.infer<typeof updateTicketFieldsSchema>;
