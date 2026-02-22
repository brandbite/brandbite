import { z } from "zod";

/** Trimmed non-empty string. */
export const trimmedString = z.string().trim().min(1);

/** Optional trimmed string that becomes null when empty. */
export const optionalTrimmedString = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

/** CUID-format string ID. */
export const cuidId = z.string().cuid();

/** Optional CUID that treats empty string as null. */
export const optionalCuidId = z
  .string()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

/** Positive integer (from string or number). */
export const positiveInt = z.coerce.number().int().positive();

/** Non-negative integer (from string or number). */
export const nonNegativeInt = z.coerce.number().int().nonnegative();
