// -----------------------------------------------------------------------------
// @file: lib/colors/contrast.ts
// @purpose: WCAG relative-luminance + contrast helpers so swatch labels stay
//           legible on any background color.
// -----------------------------------------------------------------------------

import { hexToRgb } from "./convert";
import type { RGB } from "./types";

function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance (0 = black, 1 = white). */
export function relativeLuminance(rgb: RGB): number {
  return 0.2126 * linearize(rgb.r) + 0.7152 * linearize(rgb.g) + 0.0722 * linearize(rgb.b);
}

/** WCAG contrast ratio between two hex colors (1..21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(hexToRgb(a));
  const lb = relativeLuminance(hexToRgb(b));
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Pick black or white text for the best contrast on a given background. */
export function readableTextOn(bgHex: string): "#000000" | "#ffffff" {
  return relativeLuminance(hexToRgb(bgHex)) > 0.179 ? "#000000" : "#ffffff";
}
