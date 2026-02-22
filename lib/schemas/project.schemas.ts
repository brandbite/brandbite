import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().trim().min(2, "Project name is required (min 2 characters)."),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
