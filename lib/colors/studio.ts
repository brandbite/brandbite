// -----------------------------------------------------------------------------
// @file: lib/colors/studio.ts
// @purpose: Color Studio palette model and its pure operations: named palettes
//           whose colors have stable ids, so design roles survive reordering.
//           No React, DOM or storage access.
// -----------------------------------------------------------------------------

import type { Hex } from "./types";

export const COLOR_ROLES = ["background", "text", "primary", "accent", "surface"] as const;
export type ColorRole = (typeof COLOR_ROLES)[number];

export const STUDIO_SOURCES = [
  "generator",
  "wheel",
  "tailwind",
  "ideas",
  "meanings",
  "contrast",
  "image",
  "shared",
] as const;
export type StudioSource = (typeof STUDIO_SOURCES)[number];

export interface StudioColor {
  id: string;
  hex: Hex;
  locked: boolean;
}

/** Role -> color id. A role with no entry is unassigned. */
export type StudioRoles = Partial<Record<ColorRole, string>>;

export interface StudioPalette {
  id: string;
  name: string;
  colors: StudioColor[];
  roles: StudioRoles;
  sourceTool: StudioSource;
  tags: string[];
  /** ISO 8601 timestamps. */
  createdAt: string;
  updatedAt: string;
}

export function createStudioId(): string {
  return crypto.randomUUID();
}

export function createStudioPalette(input: {
  name: string;
  hexes: Hex[];
  sourceTool: StudioSource;
  tags?: string[];
  now?: Date;
}): StudioPalette {
  const timestamp = (input.now ?? new Date()).toISOString();
  return {
    id: createStudioId(),
    name: input.name,
    colors: input.hexes.map((hex) => ({ id: createStudioId(), hex, locked: false })),
    roles: {},
    sourceTool: input.sourceTool,
    tags: input.tags ?? [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/** Copy a palette under fresh palette and color ids, remapping its roles. */
export function clonePaletteWithNewIds(palette: StudioPalette): StudioPalette {
  const idMap = new Map(palette.colors.map((c) => [c.id, createStudioId()]));
  const roles: StudioRoles = {};
  for (const role of COLOR_ROLES) {
    const newId = idMap.get(palette.roles[role] ?? "");
    if (newId) roles[role] = newId;
  }
  return {
    ...palette,
    id: createStudioId(),
    colors: palette.colors.map((c) => ({ ...c, id: idMap.get(c.id) as string })),
    roles,
    tags: [...palette.tags],
  };
}

export function duplicateStudioPalette(
  palette: StudioPalette,
  name: string,
  now: Date = new Date(),
): StudioPalette {
  const timestamp = now.toISOString();
  return {
    ...clonePaletteWithNewIds(palette),
    name,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/**
 * Remove a color and clear any roles pointing at it. `clearedRoles` lets the UI
 * tell the user which roles are now missing. The last color cannot be removed.
 */
export function removeStudioColor(
  palette: StudioPalette,
  colorId: string,
  now: Date = new Date(),
): { palette: StudioPalette; clearedRoles: ColorRole[] } {
  if (palette.colors.length <= 1 || !palette.colors.some((c) => c.id === colorId)) {
    return { palette, clearedRoles: [] };
  }
  const clearedRoles = COLOR_ROLES.filter((role) => palette.roles[role] === colorId);
  const roles = { ...palette.roles };
  for (const role of clearedRoles) delete roles[role];
  return {
    palette: {
      ...palette,
      colors: palette.colors.filter((c) => c.id !== colorId),
      roles,
      updatedAt: now.toISOString(),
    },
    clearedRoles,
  };
}

/** Move a color left (-1) or right (+1). Moves past either end change nothing. */
export function moveStudioColor(
  palette: StudioPalette,
  colorId: string,
  delta: -1 | 1,
  now: Date = new Date(),
): StudioPalette {
  const from = palette.colors.findIndex((c) => c.id === colorId);
  const to = from + delta;
  if (from === -1 || to < 0 || to >= palette.colors.length) return palette;
  const colors = [...palette.colors];
  [colors[from], colors[to]] = [colors[to], colors[from]];
  return { ...palette, colors, updatedAt: now.toISOString() };
}

/** Assign a role to a color, or clear it with null. Unknown color ids are ignored. */
export function setStudioRole(
  palette: StudioPalette,
  role: ColorRole,
  colorId: string | null,
  now: Date = new Date(),
): StudioPalette {
  if (colorId !== null && !palette.colors.some((c) => c.id === colorId)) return palette;
  const roles = { ...palette.roles };
  if (colorId === null) delete roles[role];
  else roles[role] = colorId;
  return { ...palette, roles, updatedAt: now.toISOString() };
}
