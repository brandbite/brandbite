// -----------------------------------------------------------------------------
// @file: lib/colors/harmony.ts
// @purpose: Color-theory harmonies. All operate in HSL and return a Palette.
//           Hue arithmetic always passes through wrapHue; lightness through
//           clampPct — so no combination can produce NaN or out-of-range values.
// -----------------------------------------------------------------------------

import { clampPct, paletteColorFromHsl, wrapHue } from "./convert";
import type { HarmonyKind, HSL, Palette } from "./types";

function at(
  base: HSL,
  hueOffset: number,
  overrides?: Partial<HSL>,
): ReturnType<typeof paletteColorFromHsl> {
  return paletteColorFromHsl({
    h: wrapHue(base.h + hueOffset),
    s: clampPct(overrides?.s ?? base.s),
    l: clampPct(overrides?.l ?? base.l),
  });
}

/** Base + its opposite (180°). */
export function complementary(base: HSL): Palette {
  return [at(base, 0), at(base, 180)];
}

/** `count` colors spread ±angle around the base hue (base centered). */
export function analogous(base: HSL, angle = 30, count = 5): Palette {
  const n = Math.max(2, count);
  const start = -angle * Math.floor((n - 1) / 2);
  return Array.from({ length: n }, (_, i) => at(base, start + i * angle));
}

/** Three hues 120° apart. */
export function triadic(base: HSL): Palette {
  return [at(base, 0), at(base, 120), at(base, 240)];
}

/** Rectangle scheme: base, +angle, +180, +180+angle. */
export function tetradic(base: HSL, angle = 60): Palette {
  return [at(base, 0), at(base, angle), at(base, 180), at(base, 180 + angle)];
}

/** Single hue, evenly spaced lightness stops (avoids pure 0/100). */
export function monochromatic(base: HSL, count = 5): Palette {
  const n = Math.max(2, count);
  const min = 15;
  const max = 85;
  const step = (max - min) / (n - 1);
  return Array.from({ length: n }, (_, i) =>
    paletteColorFromHsl({ h: wrapHue(base.h), s: clampPct(base.s), l: clampPct(min + i * step) }),
  );
}

/** Dispatcher used by the tools. */
export function harmony(kind: HarmonyKind, base: HSL): Palette {
  switch (kind) {
    case "complementary":
      return complementary(base);
    case "analogous":
      return analogous(base);
    case "triadic":
      return triadic(base);
    case "tetradic":
      return tetradic(base);
    case "monochromatic":
      return monochromatic(base);
    default:
      return [paletteColorFromHsl(base)];
  }
}

export const HARMONY_LABELS: Record<HarmonyKind, string> = {
  complementary: "Complementary",
  analogous: "Analogous",
  triadic: "Triadic",
  tetradic: "Tetradic",
  monochromatic: "Monochromatic",
};
