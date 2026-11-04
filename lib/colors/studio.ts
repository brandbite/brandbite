// -----------------------------------------------------------------------------
// @file: lib/colors/studio.ts
// @purpose: Color Studio palette model and its pure operations: named palettes
//           whose colors have stable ids, so design roles survive reordering.
//           No React, DOM or storage access.
// -----------------------------------------------------------------------------

import { contrastRatio, readableTextOn, relativeLuminance } from "./contrast";
import { hexToHsl, hexToRgb } from "./convert";
import { formatHex } from "./format";
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

/** Change one color's value. Its id, lock and roles stay as they were. */
export function setStudioColorHex(
  palette: StudioPalette,
  colorId: string,
  hex: Hex,
  now: Date = new Date(),
): StudioPalette {
  return {
    ...palette,
    colors: palette.colors.map((c) => (c.id === colorId ? { ...c, hex } : c)),
    updatedAt: now.toISOString(),
  };
}

export function toggleStudioLock(palette: StudioPalette, colorId: string): StudioPalette {
  return {
    ...palette,
    colors: palette.colors.map((c) => (c.id === colorId ? { ...c, locked: !c.locked } : c)),
  };
}

export function addStudioColor(
  palette: StudioPalette,
  hex: Hex,
  now: Date = new Date(),
): StudioPalette {
  return {
    ...palette,
    colors: [...palette.colors, { id: createStudioId(), hex, locked: false }],
    updatedAt: now.toISOString(),
  };
}

export interface ResolvedPaletteColors extends Record<ColorRole, Hex> {
  /** Text color with the best contrast on the primary color. */
  onPrimary: Hex;
}

/**
 * Colors for a UI preview: assigned roles first, then sensible fallbacks from the
 * palette. Text fallback picks the palette's darkest color only if it is readable
 * on the background. A primary color is never assumed to suit white text.
 */
export function resolvePaletteColors(palette: StudioPalette): ResolvedPaletteColors {
  const assigned = (role: ColorRole) =>
    palette.colors.find((c) => c.id === palette.roles[role])?.hex;
  const hexes = palette.colors.map((c) => c.hex);
  const byLuminance = [...hexes].sort(
    (a, b) => relativeLuminance(hexToRgb(a)) - relativeLuminance(hexToRgb(b)),
  );
  const darkest = byLuminance[0];
  const lightest = byLuminance[byLuminance.length - 1];
  const mostSaturated = [...hexes].sort((a, b) => hexToHsl(b).s - hexToHsl(a).s)[0];

  const background = assigned("background") ?? "#ffffff";
  const text =
    assigned("text") ??
    (contrastRatio(darkest, background) >= 4.5 ? darkest : readableTextOn(background));
  const primary = assigned("primary") ?? darkest;

  return {
    background,
    text,
    primary,
    accent: assigned("accent") ?? mostSaturated,
    surface: assigned("surface") ?? lightest,
    onPrimary: readableTextOn(primary),
  };
}

/** CSS custom properties: every color by position, then any assigned roles. */
export function studioPaletteToCss(palette: StudioPalette): string {
  const lines = palette.colors.map((c, i) => `  --color-${i + 1}: ${formatHex(c.hex)};`);
  for (const role of COLOR_ROLES) {
    const color = palette.colors.find((c) => c.id === palette.roles[role]);
    if (color) lines.push(`  --color-${role}: ${formatHex(color.hex)};`);
  }
  return `:root {\n${lines.join("\n")}\n}`;
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
