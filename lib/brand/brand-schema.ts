// -----------------------------------------------------------------------------
// @file: lib/brand/brand-schema.ts
// @purpose: Validation for edits to a brand guide and to its files.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

import { z } from "zod";

import { readBrandColors, readBrandFonts } from "./brand-data";
import { BRAND_ASSET_BACKGROUNDS, BRAND_ASSET_KINDS } from "./brand-files";

export const BRAND_LIMITS = {
  name: 80,
  short: 200,
  long: 2000,
  listItems: 12,
  listItem: 160,
  colors: 24,
  fonts: 12,
} as const;

/** Trimmed text; an empty string clears the field. */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} is too long (max ${max} characters).`)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

/** A list of short lines: trimmed, blanks and repeats dropped. */
const textList = (label: string) =>
  z
    .array(z.string())
    .transform((items) => [...new Set(items.map((item) => item.trim()).filter(Boolean))])
    .refine((items) => items.length <= BRAND_LIMITS.listItems, {
      message: `${label} can have up to ${BRAND_LIMITS.listItems} entries.`,
    })
    .refine((items) => items.every((item) => item.length <= BRAND_LIMITS.listItem), {
      message: `Each entry in ${label.toLowerCase()} can be up to ${BRAND_LIMITS.listItem} characters.`,
    })
    .optional();

export const updateBrandSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Brand name is required (min 2 characters).")
    .max(BRAND_LIMITS.name, `Brand name is too long (max ${BRAND_LIMITS.name} characters).`)
    .optional(),
  tagline: optionalText(BRAND_LIMITS.short, "Tagline"),
  description: optionalText(BRAND_LIMITS.long, "Description"),
  audience: optionalText(BRAND_LIMITS.long, "Audience"),
  values: textList("Values"),
  references: optionalText(BRAND_LIMITS.long, "References"),
  toneWords: textList("Tone words"),
  voiceNotes: optionalText(BRAND_LIMITS.long, "Voice notes"),
  voiceDo: textList("Write like this"),
  voiceDont: textList("Never write like this"),
  wordsToUse: textList("Words to use"),
  wordsToAvoid: textList("Words to avoid"),
  sampleCopy: optionalText(BRAND_LIMITS.long, "Sample copy"),
  imageryNotes: optionalText(BRAND_LIMITS.long, "Imagery notes"),
  colors: z
    .array(z.unknown())
    .max(BRAND_LIMITS.colors, `A brand can have up to ${BRAND_LIMITS.colors} colors.`)
    .refine((raw) => readBrandColors(raw).length === raw.length, {
      message: "Every color needs a valid hex code, like #1F3A5F.",
    })
    .transform((raw) => readBrandColors(raw))
    .optional(),
  fonts: z
    .array(z.unknown())
    .max(BRAND_LIMITS.fonts, `A brand can have up to ${BRAND_LIMITS.fonts} fonts.`)
    .refine((raw) => readBrandFonts(raw).length === raw.length, {
      message: "Every font needs a name.",
    })
    .transform((raw) => readBrandFonts(raw))
    .optional(),
});

export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;

export const startBrandAssetSchema = z.object({
  name: z.string().trim().min(1, "Choose a file to upload.").max(255),
  sizeBytes: z.number().int().positive("Choose a file to upload."),
  kind: z.enum(BRAND_ASSET_KINDS),
  background: z.enum(BRAND_ASSET_BACKGROUNDS).optional(),
});

export const updateBrandAssetSchema = z.object({
  kind: z.enum(BRAND_ASSET_KINDS).optional(),
  background: z.enum(BRAND_ASSET_BACKGROUNDS).optional(),
  label: optionalText(120, "Note"),
});
