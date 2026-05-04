// -----------------------------------------------------------------------------
// @file: lib/schemas/talent-application.schemas.ts
// @purpose: Server + client validation for the public /talent application
//           form. The shape mirrors the form sections 1-9 verbatim. Three
//           refinement rules cover the conditional fields:
//             - yearsRemote required when hasRemoteExp is true
//             - preferredTasksPerWeek required when workload is FULL_TIME
//             - toolsOther required when "OTHER" appears in tools
// -----------------------------------------------------------------------------

import { z } from "zod";

// ---------------------------------------------------------------------------
// Public option lists. Exported because both the form (radio/checkbox
// rendering) and the schema (z.enum) need them — keeping them here is the
// single source of truth.
// ---------------------------------------------------------------------------

export const TOTAL_YEARS = ["0-2", "2-5", "5-10", "10+"] as const;
export const WORKED_WITH = ["STARTUPS", "AGENCIES", "CORPORATE", "FREELANCE"] as const;
export const WORKLOAD = ["PART_TIME", "FULL_TIME"] as const;
export const TASKS_PER_WEEK = ["1-2", "3-5", "6+"] as const;
export const TOOLS = ["FIGMA", "ADOBE", "WEBFLOW", "CANVA", "AI_TOOLS", "OTHER"] as const;

export type TotalYears = (typeof TOTAL_YEARS)[number];
export type WorkedWith = (typeof WORKED_WITH)[number];
export type Workload = (typeof WORKLOAD)[number];
export type TasksPerWeek = (typeof TASKS_PER_WEEK)[number];
export type Tool = (typeof TOOLS)[number];

// ---------------------------------------------------------------------------
// Field-level helpers
// ---------------------------------------------------------------------------

const url = z
  .string()
  .trim()
  .url("Please enter a valid URL")
  .max(500, "URL is too long");

// Optional URL — empty string treated as absent so the form's empty-input
// rows don't 400 on submit. After this `.transform`, the value is either
// a non-empty URL string or `null`.
const optionalUrl = z
  .string()
  .trim()
  .max(500, "URL is too long")
  .optional()
  .nullable()
  .transform((v) => (v && v.length > 0 ? v : null))
  .pipe(z.string().url("Please enter a valid URL").nullable());

// ---------------------------------------------------------------------------
// Submit schema
// ---------------------------------------------------------------------------

export const talentApplicationSubmitSchema = z
  .object({
    // 1. Basic Info
    fullName: z.string().trim().min(2, "Full name is required").max(120),
    whatsappNumber: z.string().trim().min(5, "WhatsApp number is required").max(32),
    email: z.string().trim().toLowerCase().email("Please enter a valid email").max(320),
    country: z.string().trim().min(2, "Country is required").max(80),
    timezone: z.string().trim().min(2, "Timezone is required").max(64),

    // 2. Portfolio & presence
    portfolioUrl: url,
    linkedinUrl: optionalUrl,
    socialLinks: z.array(url).max(3, "At most 3 social links").default([]),

    // 3. Skills (JobTypeCategory IDs, validated against `isActive` server-side)
    categoryIds: z
      .array(z.string().min(1))
      .min(3, "Please select at least 3 categories")
      .max(30, "Too many categories selected"),

    // 4. Experience snapshot
    totalYears: z.enum(TOTAL_YEARS, {
      message: "Please select your total experience",
    }),
    hasRemoteExp: z.boolean(),
    yearsRemote: z.enum(TOTAL_YEARS).optional().nullable(),
    workedWith: z
      .array(z.enum(WORKED_WITH))
      .min(1, "Please select at least one option"),

    // 5. Availability
    workload: z.enum(WORKLOAD, { message: "Please select your availability" }),
    preferredTasksPerWeek: z.enum(TASKS_PER_WEEK).optional().nullable(),

    // 6. Turnaround reality check
    turnaroundOk: z.boolean(),
    turnaroundComment: z.string().trim().max(120, "Max 120 characters").default(""),

    // 7. Tools & stack
    tools: z.array(z.enum(TOOLS)).min(1, "Please select at least one tool"),
    toolsOther: z.string().trim().max(120).optional().nullable(),

    // 8. Test task
    testTaskOk: z.boolean(),

    // 9. Final confirmation — must be true
    communicationConfirmed: z.literal(true, {
      message: "Please confirm before submitting",
    }),

    // Anti-bot challenge — verified server-side via lib/turnstile.ts.
    turnstileToken: z.string().min(1, "Please complete the security check"),
  })
  .refine((d) => !d.hasRemoteExp || !!d.yearsRemote, {
    path: ["yearsRemote"],
    message: "Please specify your years of remote work experience",
  })
  .refine((d) => d.workload !== "FULL_TIME" || !!d.preferredTasksPerWeek, {
    path: ["preferredTasksPerWeek"],
    message: "Please select your preferred workload",
  })
  .refine((d) => !d.tools.includes("OTHER") || !!d.toolsOther, {
    path: ["toolsOther"],
    message: "Please describe your other tools",
  });

export type TalentApplicationSubmitInput = z.infer<typeof talentApplicationSubmitSchema>;
