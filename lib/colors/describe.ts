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
  red: ["Ember", "Ruby", "Poppy", "Cherry", "Crimson", "Cinnabar", "Pomegranate", "Flame"],
  orange: ["Sunset", "Amber", "Terracotta", "Tangerine", "Apricot", "Marigold", "Papaya", "Copper"],
  yellow: ["Honey", "Citrus", "Saffron", "Lemon", "Sunbeam", "Mustard", "Buttercup", "Goldenrod"],
  green: ["Forest", "Meadow", "Fern", "Moss", "Pine", "Clover", "Basil", "Jade"],
  teal: ["Lagoon", "Tide", "Seafoam", "Reef", "Spruce", "Cove", "Mineral", "Eucalyptus"],
  blue: ["Ocean", "Harbor", "Horizon", "Cobalt", "Denim", "Glacier", "Skyline", "Sapphire"],
  purple: ["Plum", "Dusk", "Iris", "Amethyst", "Violet", "Mulberry", "Twilight", "Orchid"],
  pink: ["Blossom", "Peony", "Rosewater", "Flamingo", "Sorbet", "Magnolia", "Fuchsia", "Petal"],
  brown: ["Cocoa", "Walnut", "Clay", "Chestnut", "Mocha", "Saddle", "Cedar", "Caramel"],
  gray: ["Stone", "Slate", "Mist", "Pebble", "Graphite", "Fog", "Ash", "Pewter"],
  black: ["Midnight", "Onyx", "Ink", "Obsidian", "Charcoal", "Raven", "Eclipse", "Nightfall"],
  white: ["Linen", "Cloud", "Porcelain", "Pearl", "Chalk", "Snowfall", "Cotton", "Alabaster"],
};

const MOOD_ADJECTIVES = {
  dark: ["Deep", "Moody", "Shadowed", "Velvet", "Smoky", "Inky"],
  light: ["Soft", "Airy", "Gentle", "Powder", "Hazy", "Dreamy"],
  muted: ["Quiet", "Dusty", "Faded", "Weathered", "Calm", "Understated"],
  vivid: ["Bold", "Electric", "Vivid", "Radiant", "Punchy", "Lively"],
  balanced: ["Fresh", "Modern", "Easy", "Balanced", "Clear", "Steady"],
};
const WARM_ADJECTIVES = ["Sunlit", "Toasted", "Spiced", "Glowing"];
const COOL_ADJECTIVES = ["Breezy", "Crisp", "Icy", "Coastal"];
const NEUTRAL_FAMILIES: ColorFamilySlug[] = ["gray", "black", "white"];

/** FNV-1a: small changes in the colors give a very different number. */
function hashColors(hexes: string[]): number {
  let hash = 0x811c9dc5;
  for (const char of hexes.join("")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function pick<T>(items: T[], seed: number): T {
  return items[seed % items.length];
}

/**
 * A palette name from its colors, e.g. "Deep Ocean" or "Ember & Lagoon". Nouns come
 * from the palette's two most prominent color families, and the adjective from its
 * overall lightness, saturation and temperature. The same colors always give the
 * same name; a number is added if that name is already taken.
 */
export function suggestPaletteName(hexes: string[], taken: string[] = []): string {
  if (hexes.length === 0) return "New Palette";

  const colors = hexes.map(hexToHsl);
  const prominence = new Map<ColorFamilySlug, number>();
  hexes.forEach((hex, index) => {
    const { s, l } = colors[index];
    const family = colorFamilyOf(hex);
    const score = 1 + s * (1 - Math.abs(l - 50) / 50);
    prominence.set(family, (prominence.get(family) ?? 0) + score);
  });
  const families = Array.from(prominence.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([family]) => family);

  const seed = hashColors(hexes);
  const noun = pick(PALETTE_NOUNS[families[0]], seed);

  const second = families.slice(1).find((family) => !NEUTRAL_FAMILIES.includes(family));
  let base: string;
  if (second && seed % 2 === 0) {
    base = `${noun} & ${pick(PALETTE_NOUNS[second], seed >>> 8)}`;
  } else {
    const averageL = colors.reduce((sum, c) => sum + c.l, 0) / colors.length;
    const averageS = colors.reduce((sum, c) => sum + c.s, 0) / colors.length;
    let pool = MOOD_ADJECTIVES.balanced;
    if (averageL < 35) pool = MOOD_ADJECTIVES.dark;
    else if (averageL > 75) pool = MOOD_ADJECTIVES.light;
    else if (averageS < 30) pool = MOOD_ADJECTIVES.muted;
    else if (averageS > 70) pool = MOOD_ADJECTIVES.vivid;

    const warm = colors.filter((c) => c.s > 15 && (c.h < 70 || c.h >= 320)).length;
    const cool = colors.filter((c) => c.s > 15 && c.h >= 165 && c.h < 270).length;
    if (warm > cool * 2) pool = [...pool, ...WARM_ADJECTIVES];
    else if (cool > warm * 2) pool = [...pool, ...COOL_ADJECTIVES];

    base = `${pick(pool, seed >>> 8)} ${noun}`;
  }

  const existing = new Set(taken.map((name) => name.toLowerCase()));
  if (!existing.has(base.toLowerCase())) return base;
  let number = 2;
  while (existing.has(`${base} ${number}`.toLowerCase())) number += 1;
  return `${base} ${number}`;
}
