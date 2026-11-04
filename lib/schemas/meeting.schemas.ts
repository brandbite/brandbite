// -----------------------------------------------------------------------------
// @file: lib/schemas/meeting.schemas.ts
// @purpose: Zod schemas for public meeting booking and rescheduling.
// -----------------------------------------------------------------------------

import { z } from "zod";

const isoDateTime = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Please choose a time.")
  .transform((value) => new Date(value));

export const bookMeetingSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(120),
  email: z.string().trim().email("Please enter a correct email address.").max(254),
  company: z.string().trim().max(120).optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
  timezone: z.string().trim().max(64).optional().nullable(),
  startsAt: isoDateTime,
  // Verified server-side. With TURNSTILE_SECRET_KEY set, an empty token fails.
  turnstileToken: z.string().optional().default(""),
});

export const rescheduleMeetingSchema = z.object({
  startsAt: isoDateTime,
});
