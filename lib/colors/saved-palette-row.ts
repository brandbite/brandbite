// -----------------------------------------------------------------------------
// @file: lib/colors/saved-palette-row.ts
// @purpose: Convert SavedPalette database rows to StudioPalette. Rows saved before
//           Color Studio hold plain hex strings and uppercase tool names; they
//           are converted on read, so no data migration is needed.
// -----------------------------------------------------------------------------

import { parseOpaqueHex } from "./convert";
import {
  COLOR_ROLES,
  STUDIO_SOURCES,
  type StudioColor,
  type StudioPalette,
  type StudioRoles,
  type StudioSource,
} from "./studio";

const LEGACY_SOURCES: Record<string, StudioSource> = {
  WHEEL: "wheel",
  GENERATOR: "generator",
  EXTRACTOR: "image",
};

export interface SavedPaletteRow {
  id: string;
  name: string;
  colors: unknown;
  roles: unknown;
  tags: string[];
  source: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function toSource(source: string | null): StudioSource {
  if (source && (STUDIO_SOURCES as readonly string[]).includes(source)) {
    return source as StudioSource;
  }
  return LEGACY_SOURCES[source ?? ""] ?? "generator";
}

function toColors(raw: unknown): StudioColor[] {
  if (!Array.isArray(raw)) return [];
  const colors: StudioColor[] = [];
  raw.forEach((entry, index) => {
    const isLegacy = typeof entry === "string";
    const hex = parseOpaqueHex(isLegacy ? entry : entry?.hex);
    if (!hex) return;
    colors.push({
      // Legacy rows have no color ids. Their position is stable until the next save.
      id: !isLegacy && typeof entry?.id === "string" ? entry.id : `legacy-${index}`,
      hex,
      locked: !isLegacy && entry?.locked === true,
    });
  });
  return colors;
}

function toRoles(raw: unknown, colors: StudioColor[]): StudioRoles {
  const roles: StudioRoles = {};
  if (typeof raw !== "object" || raw === null) return roles;
  for (const role of COLOR_ROLES) {
    const colorId = (raw as Record<string, unknown>)[role];
    if (colors.some((c) => c.id === colorId)) roles[role] = colorId as string;
  }
  return roles;
}

/** Returns null for a row with no readable colors. */
export function savedPaletteFromRow(row: SavedPaletteRow): StudioPalette | null {
  const colors = toColors(row.colors);
  if (colors.length === 0) return null;
  return {
    id: row.id,
    name: row.name,
    colors,
    roles: toRoles(row.roles, colors),
    sourceTool: toSource(row.source),
    tags: row.tags,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** The columns written for a palette. Timestamps are always set by the database. */
export function savedPaletteToRowData(palette: StudioPalette) {
  return {
    name: palette.name,
    colors: palette.colors.map((c) => ({ id: c.id, hex: c.hex, locked: c.locked })),
    roles: palette.roles,
    tags: palette.tags,
    source: palette.sourceTool,
  };
}
