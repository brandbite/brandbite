// -----------------------------------------------------------------------------
// @file: lib/colors/tailwind.ts
// @purpose: Generate a Tailwind-style shade scale (50–950) from a single base
//           color, à la uicolors.app. The base color is pinned to whichever
//           stop its lightness is closest to; the rest keep the hue/saturation
//           and move to fixed target lightness values. Also formats the scale
//           as a Tailwind `theme.extend.colors` block and as CSS variables.
// -----------------------------------------------------------------------------

import type { Hex, HSL } from "./types";
import { clampPct, hexToHsl, hslToHex, normalizeHex } from "./convert";

export const TAILWIND_STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

// Target lightness (HSL L, 0–100) per stop. Not linear — mirrors the perceptual
// curve of Tailwind's own default palettes closely enough for a generator.
const STOP_LIGHTNESS: Record<number, number> = {
  50: 97,
  100: 93,
  200: 86,
  300: 76,
  400: 64,
  500: 53,
  600: 46,
  700: 39,
  800: 32,
  900: 27,
  950: 16,
};

export interface TailwindShade {
  stop: number;
  hex: Hex;
  hsl: HSL;
  /** True for the stop the input color was pinned to (kept verbatim). */
  isBase: boolean;
}

/**
 * Build the 11-stop scale. The input is placed at the stop whose target
 * lightness is nearest the input's own lightness (so a mid color lands ~500,
 * a pale one ~200, etc.), keeping the exact input hex at that stop.
 */
export function tailwindScale(input: string): TailwindShade[] {
  const hex = normalizeHex(input) ?? "#000000";
  const base = hexToHsl(hex);

  // Nearest stop by lightness distance.
  let baseStop = 500;
  let best = Infinity;
  for (const stop of TAILWIND_STOPS) {
    const d = Math.abs(STOP_LIGHTNESS[stop] - base.l);
    if (d < best) {
      best = d;
      baseStop = stop;
    }
  }

  return TAILWIND_STOPS.map((stop) => {
    if (stop === baseStop) {
      return { stop, hex, hsl: base, isBase: true };
    }
    const hsl: HSL = { h: base.h, s: clampPct(base.s), l: clampPct(STOP_LIGHTNESS[stop]) };
    return { stop, hex: hslToHex(hsl), hsl, isBase: false };
  });
}

/** Sanitize a user-supplied color name into a valid Tailwind key. */
export function toColorKey(name: string): string {
  const key = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return key || "brand";
}

/** Format the scale as a `tailwind.config` colors block. */
export function tailwindScaleToConfig(name: string, shades: TailwindShade[]): string {
  const key = toColorKey(name);
  const lines = shades.map((s) => `      '${s.stop}': '${s.hex}',`);
  return `colors: {\n    '${key}': {\n${lines.join("\n")}\n    },\n  },`;
}

/** Format the scale as CSS custom properties. */
export function tailwindScaleToCssVars(name: string, shades: TailwindShade[]): string {
  const key = toColorKey(name);
  const lines = shades.map((s) => `  --${key}-${s.stop}: ${s.hex};`);
  return `:root {\n${lines.join("\n")}\n}`;
}
