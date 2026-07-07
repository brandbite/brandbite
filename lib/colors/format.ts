// -----------------------------------------------------------------------------
// @file: lib/colors/format.ts
// @purpose: Human-readable string formatters for the copy-to-clipboard actions
//           and CSS export.
// -----------------------------------------------------------------------------

import { normalizeHex } from "./convert";
import type { HSL, Palette, PaletteColor, RGB } from "./types";

export type ColorFormat = "hex" | "rgb" | "hsl";

export const COLOR_FORMATS: ColorFormat[] = ["hex", "rgb", "hsl"];

/** Uppercase display hex, e.g. "#F15B2B". */
export function formatHex(hex: string): string {
  return (normalizeHex(hex) ?? "#000000").toUpperCase();
}

export function formatRgb(rgb: RGB): string {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

export function formatHsl(hsl: HSL): string {
  return `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%)`;
}

/** Format one color in the requested representation (for copy). */
export function formatFor(kind: ColorFormat, c: PaletteColor): string {
  if (kind === "rgb") return formatRgb(c.rgb);
  if (kind === "hsl") return formatHsl(c.hsl);
  return formatHex(c.hex);
}

/** Export a palette as a CSS custom-property block. */
export function paletteToCss(palette: Palette): string {
  const lines = palette.map((c, i) => `  --color-${i + 1}: ${formatHex(c.hex)};`);
  return `:root {\n${lines.join("\n")}\n}`;
}

/** Export a palette's hex values as a comma-separated string. */
export function paletteToHexList(palette: Palette): string {
  return palette.map((c) => formatHex(c.hex)).join(", ");
}
