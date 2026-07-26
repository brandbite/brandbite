// -----------------------------------------------------------------------------
// @file: lib/schemas/contact.schemas.ts
// @purpose: Zod schema for the public /contact form submission. Mirrors the
//           field caps used by the talent application schema so parseBody
//           error envelopes look identical across public forms.
// -----------------------------------------------------------------------------

import { z } from "zod";

export const contactSubmitSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(120),
  email: z.string().trim().email("Please enter a correct email address.").max(254),
  company: z.string().trim().max(120).optional().nullable(),
  topic: z.string().trim().max(200).optional().nullable(),
  message: z.string().trim().min(1, "Please tell us a bit more.").max(5000),
  // Anti-bot challenge — verified server-side via lib/turnstile.ts. Optional
  // (unlike talent) so local dev without Turnstile keys still submits; with
  // TURNSTILE_SECRET_KEY set, verifyTurnstileToken fails closed on "".
  turnstileToken: z.string().optional().default(""),
});

export type ContactSubmitInput = z.infer<typeof contactSubmitSchema>;
