import { z } from "zod";

const ALLOWED_ASSIGNED_ROLES = ["MEMBER", "PM", "BILLING"] as const;

export const createInviteSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Email is required.")
    .email("Please enter a valid email address."),
  roleInCompany: z.enum(ALLOWED_ASSIGNED_ROLES).optional().default("MEMBER"),
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;
