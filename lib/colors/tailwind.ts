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

/** Lightness anchors for the two endpoints of the ramp (stop 50 and 950). */
const LIGHT_END_L = 97;
const DARK_END_L = 13;

/** Pick the stop whose target lightness is closest to a given lightness. */
export function nearestStop(lightness: number): number {
  let stop = 500;
  let best = Infinity;
  for (const s of TAILWIND_STOPS) {
    const d = Math.abs(STOP_LIGHTNESS[s] - lightness);
    if (d < best) {
      best = d;
      stop = s;
    }
  }
  return stop;
}

/**
 * Build the 11-stop scale, keeping the exact input hex at the base stop.
 *
 * `baseStop` chooses which stop holds the input color. When omitted (or not a
 * valid stop) it auto-selects the stop nearest the input's lightness. The other
 * stops interpolate lightness from the input toward near-white (stop 50) on the
 * light side and near-black (stop 950) on the dark side, so the ramp stays
 * smooth and monotonic wherever the base is anchored.
 */
export function tailwindScale(input: string, baseStop?: number): TailwindShade[] {
  const hex = normalizeHex(input) ?? "#000000";
  const base = hexToHsl(hex);

  const anchor =
    baseStop && (TAILWIND_STOPS as readonly number[]).includes(baseStop)
      ? baseStop
      : nearestStop(base.l);
  const baseIdx = TAILWIND_STOPS.indexOf(anchor as (typeof TAILWIND_STOPS)[number]);
  const lastIdx = TAILWIND_STOPS.length - 1;

  return TAILWIND_STOPS.map((stop, i) => {
    if (i === baseIdx) {
      return { stop, hex, hsl: base, isBase: true };
    }
    let l: number;
    if (i < baseIdx) {
      // Lighter side: 50 → base.
      const t = baseIdx === 0 ? 0 : i / baseIdx;
      l = LIGHT_END_L + (base.l - LIGHT_END_L) * t;
    } else {
      // Darker side: base → 950.
      const span = lastIdx - baseIdx;
      const t = span === 0 ? 1 : (i - baseIdx) / span;
      l = base.l + (DARK_END_L - base.l) * t;
    }
    const hsl: HSL = { h: base.h, s: clampPct(base.s), l: clampPct(l) };
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
