// -----------------------------------------------------------------------------
// @file: lib/colors/types.ts
// @purpose: Shared types for the color-tools engine (conversions, harmonies,
//           palettes). Pure data — no React, no DOM.
// -----------------------------------------------------------------------------

/** Normalized 6-digit hex, lowercase, with leading '#', e.g. "#f15b2b". */
export type Hex = string;

/** 0–255 integer channels. */
export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** h: 0–360, s: 0–100, l: 0–100. */
export interface HSL {
  h: number;
  s: number;
  l: number;
}

export type HarmonyKind = "complementary" | "analogous" | "triadic" | "tetradic" | "monochromatic";

/** A single color carried through the UI with all three representations. */
export interface PaletteColor {
  hex: Hex;
  rgb: RGB;
  hsl: HSL;
  /** When true, regeneration leaves this color untouched. */
  locked?: boolean;
}

export type Palette = PaletteColor[];

/** Which tool produced a saved palette (stored on SavedPalette.source). */
export type PaletteSource = "WHEEL" | "GENERATOR" | "EXTRACTOR";

/** Shape returned by the /api/colors/palettes endpoints. */
export interface SavedPaletteDTO {
  id: string;
  name: string;
  colors: string[];
  source: PaletteSource | null;
  createdAt: string;
}
