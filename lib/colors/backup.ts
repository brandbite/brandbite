// -----------------------------------------------------------------------------
// @file: lib/colors/backup.ts
// @purpose: Export and validated import of Color Studio saved palettes. Imported
//           palettes always get new ids, so they can never overwrite existing
//           records. Kept out of the lib/colors barrel so zod only loads on the
//           page that needs it.
// -----------------------------------------------------------------------------

import { z } from "zod";

import { MAX_SAVED_PALETTES, studioPaletteSchema } from "./palette-schema";
import { clonePaletteWithNewIds, type StudioPalette } from "./studio";

export const BACKUP_SCHEMA_VERSION = 1;
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

const backupSchema = z.object({
  schemaVersion: z.literal(BACKUP_SCHEMA_VERSION),
  exportedAt: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
  palettes: z.array(studioPaletteSchema).max(MAX_SAVED_PALETTES),
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

  return { ok: true, palettes: parsed.data.palettes.map(clonePaletteWithNewIds) };
}
