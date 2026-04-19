// -----------------------------------------------------------------------------
// @file: lib/ai/idempotency.ts
// @purpose: Read and validate the Idempotency-Key header for AI routes
// -----------------------------------------------------------------------------

import { z } from "zod";

const idempotencyKeySchema = z.string().uuid();

/**
 * Extract the Idempotency-Key header. Returns null when absent, throws a
 * ValidationError-shaped error when present but not a valid UUID.
 */
export function readIdempotencyKey(headers: Headers): string | null {
  const raw = headers.get("idempotency-key");
  if (!raw) return null;

  const parsed = idempotencyKeySchema.safeParse(raw.trim());
  if (!parsed.success) {
    const error: Error & { code?: string } = new Error("INVALID_IDEMPOTENCY_KEY");
    error.code = "INVALID_IDEMPOTENCY_KEY";
    throw error;
  }
  return parsed.data;
}
