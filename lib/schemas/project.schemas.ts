import { z } from "zod";
import { abbreviationSchema } from "@/lib/abbreviation";

export const createProjectSchema = z.object({
  name: z.string().trim().min(2, "Project name is required (min 2 characters)."),
  code: abbreviationSchema.optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().trim().min(2, "Project name is required (min 2 characters).").optional(),
  code: abbreviationSchema.optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
