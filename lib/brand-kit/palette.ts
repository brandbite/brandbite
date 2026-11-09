// -----------------------------------------------------------------------------
// @file: lib/brand-kit/palette.ts
// @purpose: Builds a five-role brand palette (primary, secondary, accent, dark,
//           light) from one base color and a personality. Rule-based and
//           deterministic, so the same inputs always give the same kit and a
//           shared link reproduces it.
// -----------------------------------------------------------------------------

import {
  contrastRatio,
  hexToHsl,
  hslToHex,
  normalizeHex,
  readableTextOn,
  wrapHue,
} from "@/lib/colors";

import type { Personality } from "./fonts";

export type BrandColorRole = "primary" | "secondary" | "accent" | "dark" | "light";

export type BrandColor = {
  role: BrandColorRole;
  label: string;
  hex: string;
  /** Black or white, whichever reads better on this color. */
  textOn: string;
};

/**
 * Hue offsets for secondary and accent per personality, and how saturated
 * they are relative to the base. Variant cycles through the list.
 */
const RECIPES: Record<
  Personality,
  { secondary: number; accent: number; secondarySat: number; accentSat: number }[]
> = {
  Modern: [
    { secondary: 30, accent: 180, secondarySat: 0.8, accentSat: 1 },
    { secondary: -30, accent: 150, secondarySat: 0.7, accentSat: 1 },
  ],
  Classic: [
    { secondary: 180, accent: 40, secondarySat: 0.45, accentSat: 0.7 },
    { secondary: 20, accent: 200, secondarySat: 0.5, accentSat: 0.6 },
  ],
  Playful: [
    { secondary: 120, accent: 240, secondarySat: 1, accentSat: 1 },
    { secondary: 60, accent: 180, secondarySat: 1, accentSat: 1 },
  ],
  Luxury: [
    { secondary: 0, accent: 45, secondarySat: 0.35, accentSat: 0.6 },
    { secondary: 180, accent: 30, secondarySat: 0.25, accentSat: 0.55 },
  ],
  Techy: [
    { secondary: 200, accent: 150, secondarySat: 0.9, accentSat: 1 },
    { secondary: -40, accent: 180, secondarySat: 0.9, accentSat: 1 },
  ],
  Friendly: [
    { secondary: 40, accent: 160, secondarySat: 0.75, accentSat: 0.85 },
    { secondary: -40, accent: 200, secondarySat: 0.75, accentSat: 0.85 },
  ],
  Bold: [
    { secondary: 180, accent: 60, secondarySat: 1, accentSat: 1 },
    { secondary: 150, accent: 210, secondarySat: 1, accentSat: 1 },
  ],
};

export function recipeCount(personality: Personality): number {
  return RECIPES[personality].length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function color(role: BrandColorRole, label: string, hex: string): BrandColor {
  return { role, label, hex, textOn: readableTextOn(hex) };
}

export function brandPalette(
  baseInput: string,
  personality: Personality,
  variant = 0,
): BrandColor[] {
  const base = normalizeHex(baseInput) ?? "#ff6426";
  const hsl = hexToHsl(base);
  const recipes = RECIPES[personality];
  const recipe = recipes[((variant % recipes.length) + recipes.length) % recipes.length];

  // Very grey bases still need some color in secondary and accent.
  const sat = Math.max(hsl.s, 35);
  const midLightness = clamp(hsl.l, 35, 60);

  const secondary = hslToHex({
    h: wrapHue(hsl.h + recipe.secondary),
    s: clamp(sat * recipe.secondarySat, 15, 95),
    l: midLightness,
  });
  const accent = hslToHex({
    h: wrapHue(hsl.h + recipe.accent),
    s: clamp(sat * recipe.accentSat, 20, 100),
    l: clamp(midLightness + 5, 40, 62),
  });
  const neutralSat = personality === "Luxury" ? 8 : 18;
  const dark = hslToHex({ h: hsl.h, s: neutralSat, l: 12 });
  const light = hslToHex({ h: hsl.h, s: neutralSat + 12, l: 96 });

  return [
    color("primary", "Primary", base),
    color("secondary", "Secondary", secondary),
    color("accent", "Accent", accent),
    color("dark", "Dark", dark),
    color("light", "Light", light),
  ];
}

/** Text on the light background must stay readable, so the dark role is checked. */
export function paletteIsReadable(palette: BrandColor[]): boolean {
  const dark = palette.find((c) => c.role === "dark")!;
  const light = palette.find((c) => c.role === "light")!;
  return contrastRatio(dark.hex, light.hex) >= 7;
}

/** CSS custom properties for the palette and fonts. */
export function brandKitCss(palette: BrandColor[], headingFont: string, bodyFont: string): string {
  const lines = [":root {"];
  for (const c of palette) lines.push(`  --brand-${c.role}: ${c.hex};`);
  lines.push(`  --font-heading: "${headingFont}", serif;`);
  lines.push(`  --font-body: "${bodyFont}", sans-serif;`);
  lines.push("}");
  return lines.join("\n");
}
