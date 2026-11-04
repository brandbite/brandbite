// -----------------------------------------------------------------------------
// @file: lib/colors/palette-schema.ts
// @purpose: Validation for palettes arriving from outside the running page:
//           backup files and API requests. Kept out of the lib/colors barrel so
//           zod doesn't load on every tool page.
// -----------------------------------------------------------------------------

import { z } from "zod";

import { parseOpaqueHex } from "./convert";
import { COLOR_ROLES, STUDIO_SOURCES, type StudioPalette, type StudioRoles } from "./studio";

export const MAX_SAVED_PALETTES = 500;

const isoTimestamp = z.string().refine((value) => !Number.isNaN(Date.parse(value)));

const colorSchema = z.object({
  id: z.string().min(1).max(64),
  hex: z.string().transform((value, ctx) => {
    const hex = parseOpaqueHex(value);
    if (!hex) {
      ctx.addIssue({ code: "custom", message: "All colors must be valid hex values." });
      return z.NEVER;
    }
    return hex;
  }),
  locked: z.boolean().default(false),
});

/** Roles pointing at colors the palette doesn't have are dropped. */
export const studioPaletteSchema = z
  .object({
    id: z.string().min(1).max(64),
    name: z
      .string()
      .trim()
      .min(1, "Name is required.")
      .max(80, "Name must be 80 characters or fewer."),
    colors: z
      .array(colorSchema)
      .min(1, "A palette must have between 1 and 12 colors.")
      .max(12, "A palette must have between 1 and 12 colors."),
    roles: z.partialRecord(z.enum(COLOR_ROLES), z.string()).default({}),
    sourceTool: z.enum(STUDIO_SOURCES),
    tags: z.array(z.string().max(40)).max(20).default([]),
    createdAt: isoTimestamp,
    updatedAt: isoTimestamp,
  })
  .refine((palette) => new Set(palette.colors.map((c) => c.id)).size === palette.colors.length, {
    message: "Color ids must be unique.",
  })
  .transform((palette): StudioPalette => {
    const colorIds = new Set(palette.colors.map((c) => c.id));
    const roles: StudioRoles = {};
    for (const role of COLOR_ROLES) {
      const colorId = palette.roles[role];
      if (colorId && colorIds.has(colorId)) roles[role] = colorId;
    }
    return { ...palette, roles };
  });
