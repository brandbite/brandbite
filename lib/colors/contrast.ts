// -----------------------------------------------------------------------------
// @file: lib/colors/contrast.ts
// @purpose: WCAG relative-luminance + contrast helpers: legible swatch labels,
//           pass/fail results for the Contrast checker, and lightness-only
//           suggestions for failing pairs.
// -----------------------------------------------------------------------------

import { hexToHsl, hexToRgb, hslToHex } from "./convert";
import type { Hex, RGB } from "./types";

function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
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

/** WCAG 2.2 SC 1.4.3 (AA) and SC 1.4.6 (AAA) minimum ratios. */
export const CONTRAST_THRESHOLDS = {
  aa: { normal: 4.5, large: 3 },
  aaa: { normal: 7, large: 4.5 },
} as const;

export interface ContrastResult {
  /** Unrounded ratio. Compare against this, never against a formatted value. */
  ratio: number;
  aaNormal: boolean;
  aaLarge: boolean;
  aaaNormal: boolean;
  aaaLarge: boolean;
}

/** Evaluate all four WCAG text results for a pair of opaque colors. */
export function evaluateContrast(foreground: string, background: string): ContrastResult {
  const ratio = contrastRatio(foreground, background);
  return {
    ratio,
    aaNormal: ratio >= CONTRAST_THRESHOLDS.aa.normal,
    aaLarge: ratio >= CONTRAST_THRESHOLDS.aa.large,
    aaaNormal: ratio >= CONTRAST_THRESHOLDS.aaa.normal,
    aaaLarge: ratio >= CONTRAST_THRESHOLDS.aaa.large,
  };
}

/** WCAG "large text": at least 24px, or at least 14pt (18.67px) when bold. */
export function isLargeText(sizePx: number, weight: number): boolean {
  return sizePx >= (weight >= 700 ? (14 * 4) / 3 : 24);
}

/**
 * Display a ratio with two decimals, rounding down. Rounding to nearest would
 * show 4.499 as "4.50:1" next to a failed AA result.
 */
export function formatContrastRatio(ratio: number): string {
  return `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1`;
}

/**
 * Find the color closest in lightness to `color` that reaches `minRatio` against
 * `against`, keeping hue and saturation. Returns `color` when it already passes
 * and null when no lightness can reach the ratio.
 */
export function suggestAccessibleColor(color: string, against: string, minRatio = 4.5): Hex | null {
  if (contrastRatio(color, against) >= minRatio) return hslToHex(hexToHsl(color));

  const base = hexToHsl(color);
  const STEP = 0.25;
  for (let distance = STEP; distance <= 100; distance += STEP) {
    for (const l of [base.l - distance, base.l + distance]) {
      if (l < 0 || l > 100) continue;
      const candidate = hslToHex({ ...base, l });
      if (contrastRatio(candidate, against) >= minRatio) return candidate;
    }
  }
  return null;
}
