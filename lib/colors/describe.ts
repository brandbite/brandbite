// -----------------------------------------------------------------------------
// @file: lib/colors/describe.ts
// @purpose: Rule-based naming: which color family a HEX belongs to, a readable
//           name for it, a suggested palette name, and colors that pair with it.
//           Deterministic: the same input always gives the same result.
// -----------------------------------------------------------------------------

import { hexToHsl, hslToHex, wrapHue } from "./convert";

export const COLOR_FAMILY_SLUGS = [
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
  "pink",
  "brown",
  "gray",
  "black",
  "white",
] as const;
export type ColorFamilySlug = (typeof COLOR_FAMILY_SLUGS)[number];

export function colorFamilyOf(hex: string): ColorFamilySlug {
  const { h, s, l } = hexToHsl(hex);
  if (l <= 10) return "black";
  if (l >= 96) return "white";
  if (s <= 12) return "gray";
  if ((h >= 320 && h < 345) || (h >= 345 && l >= 72) || (h < 10 && l >= 82)) return "pink";
  if (h < 15 || h >= 345) return "red";
  if (h < 45) return l <= 38 ? "brown" : "orange";
  if (h < 70) return "yellow";
  if (h < 165) return "green";
  if (h < 195) return "teal";
  if (h < 255) return "blue";
  return "purple";
}

function title(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A readable name, e.g. "Deep Orange" or "Pale Blue". */
export function describeColor(hex: string): { name: string; family: ColorFamilySlug } {
  const family = colorFamilyOf(hex);
  if (family === "black" || family === "white") return { name: title(family), family };

  const { s, l } = hexToHsl(hex);
  if (family === "gray") {
    const shade = l < 35 ? "Dark " : l > 70 ? "Light " : "";
    return { name: `${shade}Gray`, family };
  }
  let modifier = "";
  if (l < 30) modifier = "Deep ";
  else if (l > 78) modifier = "Pale ";
  else if (s < 35) modifier = "Muted ";
  else if (s >= 85) modifier = "Vivid ";
  return { name: `${modifier}${title(family)}`, family };
}

/** Colors that work with a base: its complement, a neighbor, a tint and a shade. */
export function suggestPairings(hex: string): string[] {
  const { h, s, l } = hexToHsl(hex);
  const saturation = Math.max(s, 30);
  return [
    hslToHex({ h: wrapHue(h + 180), s: saturation, l: Math.max(35, Math.min(60, l)) }),
    hslToHex({ h: wrapHue(h + 30), s: saturation, l: Math.max(35, Math.min(65, l)) }),
    hslToHex({ h, s: Math.min(saturation, 70), l: 92 }),
    hslToHex({ h, s: Math.min(saturation, 70), l: 18 }),
  ];
}

const PALETTE_NOUNS: Record<ColorFamilySlug, string[]> = {
  red: ["Ember", "Ruby", "Poppy"],
  orange: ["Sunset", "Amber", "Terracotta"],
  yellow: ["Honey", "Citrus", "Saffron"],
  green: ["Forest", "Meadow", "Fern"],
  teal: ["Lagoon", "Tide", "Seafoam"],
  blue: ["Ocean", "Harbor", "Horizon"],
  purple: ["Plum", "Dusk", "Iris"],
  pink: ["Blossom", "Peony", "Rosewater"],
  brown: ["Cocoa", "Walnut", "Clay"],
  gray: ["Stone", "Slate", "Mist"],
  black: ["Midnight", "Onyx", "Ink"],
  white: ["Linen", "Cloud", "Porcelain"],
};

/**
 * A palette name from its colors, e.g. "Deep Ocean". The noun comes from the most
 * prominent color, the adjective from the palette's overall lightness and
 * saturation. A number is added if the name is already taken.
 */
export function suggestPaletteName(hexes: string[], taken: string[] = []): string {
  if (hexes.length === 0) return "New Palette";

  const colors = hexes.map(hexToHsl);
  let anchor = 0;
  let bestScore = -1;
  colors.forEach(({ s, l }, index) => {
    const score = s * (1 - Math.abs(l - 50) / 50);
    if (score > bestScore) {
      bestScore = score;
      anchor = index;
    }
  });

  const averageL = colors.reduce((sum, c) => sum + c.l, 0) / colors.length;
  const averageS = colors.reduce((sum, c) => sum + c.s, 0) / colors.length;
  let adjective = "Fresh";
  if (averageL < 35) adjective = "Deep";
  else if (averageL > 75) adjective = "Soft";
  else if (averageS < 30) adjective = "Quiet";
  else if (averageS > 70) adjective = "Bold";

  const nouns = PALETTE_NOUNS[colorFamilyOf(hexes[anchor])];
  const seed = hexes
    .join("")
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const base = `${adjective} ${nouns[seed % nouns.length]}`;

  const existing = new Set(taken.map((name) => name.toLowerCase()));
  if (!existing.has(base.toLowerCase())) return base;
  let number = 2;
  while (existing.has(`${base} ${number}`.toLowerCase())) number += 1;
  return `${base} ${number}`;
}
