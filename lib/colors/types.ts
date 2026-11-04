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

/** Which tool produced a palette, as named by the pre-Color Studio tool pages. */
export type PaletteSource = "WHEEL" | "GENERATOR" | "EXTRACTOR";
