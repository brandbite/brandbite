// -----------------------------------------------------------------------------
// @file: lib/colors/backup.ts
// @purpose: Export and validated import of Color Studio saved palettes. Imported
//           palettes always get new ids, so they can never overwrite existing
//           records. Kept out of the lib/colors barrel so zod only loads on the
//           page that needs it.
// -----------------------------------------------------------------------------

import { z } from "zod";

import { parseOpaqueHex } from "./convert";
import {
  clonePaletteWithNewIds,
  COLOR_ROLES,
  STUDIO_SOURCES,
  type StudioPalette,
  type StudioRoles,
} from "./studio";

export const BACKUP_SCHEMA_VERSION = 1;
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

const isoTimestamp = z.string().refine((value) => !Number.isNaN(Date.parse(value)));

const colorSchema = z.object({
  id: z.string().min(1),
  hex: z.string().transform((value, ctx) => {
    const hex = parseOpaqueHex(value);
    if (!hex) {
      ctx.addIssue({ code: "custom", message: "Invalid color" });
      return z.NEVER;
    }
    return hex;
  }),
  locked: z.boolean().default(false),
});

const paletteSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1).max(80),
    colors: z.array(colorSchema).min(1).max(12),
    roles: z.partialRecord(z.enum(COLOR_ROLES), z.string()).default({}),
    sourceTool: z.enum(STUDIO_SOURCES),
    tags: z.array(z.string().max(40)).max(20).default([]),
    createdAt: isoTimestamp,
    updatedAt: isoTimestamp,
  })
  .refine((palette) => new Set(palette.colors.map((c) => c.id)).size === palette.colors.length);

const backupSchema = z.object({
  schemaVersion: z.literal(BACKUP_SCHEMA_VERSION),
  exportedAt: isoTimestamp,
  palettes: z.array(paletteSchema).max(500),
});

export function serializeBackup(palettes: StudioPalette[], now: Date = new Date()): string {
  return JSON.stringify(
    { schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: now.toISOString(), palettes },
    null,
    2,
  );
}

export type BackupError = "too-large" | "not-json" | "invalid-backup";

export type BackupParseResult =
  | { ok: true; palettes: StudioPalette[] }
  | { ok: false; error: BackupError };

/** Validate backup text. Returned palettes have new ids; roles pointing at missing colors are dropped. */
export function parseBackup(text: string): BackupParseResult {
  if (new Blob([text]).size > MAX_BACKUP_BYTES) return { ok: false, error: "too-large" };

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "not-json" };
  }

  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid-backup" };

  return {
    ok: true,
    palettes: parsed.data.palettes.map((palette) => {
      const colorIds = new Set(palette.colors.map((c) => c.id));
      const roles: StudioRoles = {};
      for (const role of COLOR_ROLES) {
        const colorId = palette.roles[role];
        if (colorId && colorIds.has(colorId)) roles[role] = colorId;
      }
      return clonePaletteWithNewIds({ ...palette, roles });
    }),
  };
}
