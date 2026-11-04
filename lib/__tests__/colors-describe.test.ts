import { describe, expect, it } from "vitest";

import {
  colorFamilyOf,
  COLOR_FAMILY_SLUGS,
  contrastRatio,
  describeColor,
  harmonyOfSize,
  normalizeHex,
  suggestPairings,
  suggestPaletteName,
} from "@/lib/colors";
import { COLOR_FAMILIES } from "@/lib/colors/color-families";
import { MEANING_GUIDANCE } from "@/lib/colors/meaning-guidance";
import { PALETTE_IDEA_CATALOG } from "@/lib/colors/palette-idea-catalog";

describe("colorFamilyOf", () => {
  it.each([
    ["#e63946", "red"],
    ["#ff6426", "orange"],
    ["#ffd60a", "yellow"],
    ["#2e8b57", "green"],
    ["#14919b", "teal"],
    ["#0077b6", "blue"],
    ["#7b2cbf", "purple"],
    ["#f472b6", "pink"],
    ["#ffc0cb", "pink"],
    ["#8b4513", "brown"],
    ["#808080", "gray"],
    ["#000000", "black"],
    ["#ffffff", "white"],
  ])("%s is %s", (hex, family) => {
    expect(colorFamilyOf(hex)).toBe(family);
  });
});

describe("describeColor", () => {
  it("adds a modifier from lightness and saturation", () => {
    expect(describeColor("#ff6426").name).toBe("Vivid Orange");
    expect(describeColor("#0a2a43").name).toBe("Deep Blue");
    expect(describeColor("#bfdbfe").name).toBe("Pale Blue");
    expect(describeColor("#7a9e7e").name).toBe("Muted Green");
  });

  it("names neutrals plainly", () => {
    expect(describeColor("#000000").name).toBe("Black");
    expect(describeColor("#ffffff").name).toBe("White");
    expect(describeColor("#333333").name).toBe("Dark Gray");
    expect(describeColor("#cccccc").name).toBe("Light Gray");
  });

  it("gives the same result every time", () => {
    expect(describeColor("#3a86ff")).toEqual(describeColor("#3a86ff"));
  });
});

describe("suggestPaletteName", () => {
  const OCEAN = ["#0a2a43", "#17567a", "#123a7a"];

  /** Palettes like the generator's: every harmony, across hues and lightness. */
  function generatedPalettes(count: number): string[][] {
    let state = 0.137;
    const random = () => {
      state = (state * 9301 + 0.49297) % 1;
      return state;
    };
    const kinds = ["analogous", "complementary", "triadic", "tetradic", "monochromatic"] as const;
    return Array.from({ length: count }, (_, i) => {
      const base = {
        h: Math.floor(random() * 360),
        s: 55 + Math.floor(random() * 35),
        l: 45 + Math.floor(random() * 25),
      };
      return harmonyOfSize(kinds[i % kinds.length], base, 5).map((c) => c.hex);
    });
  }

  it("gives the same name for the same colors", () => {
    expect(suggestPaletteName(OCEAN)).toBe(suggestPaletteName(OCEAN));
  });

  it("uses words from the palette's main color family", () => {
    const blueWords = /Ocean|Harbor|Horizon|Cobalt|Denim|Glacier|Skyline|Sapphire/;
    expect(suggestPaletteName(OCEAN)).toMatch(blueWords);
    expect(suggestPaletteName(["#ff6426", "#ff8a3d", "#ffb26b"])).toMatch(
      /Sunset|Amber|Terracotta|Tangerine|Apricot|Marigold|Papaya|Copper/,
    );
  });

  it("rarely repeats a name across generated palettes", () => {
    const names = generatedPalettes(300).map((hexes) => suggestPaletteName(hexes));
    expect(new Set(names).size).toBeGreaterThan(names.length * 0.7);
  });

  it("doesn't lean on one opening word", () => {
    const counts = new Map<string, number>();
    const names = generatedPalettes(300).map((hexes) => suggestPaletteName(hexes));
    for (const name of names) {
      const word = name.split(" ")[0];
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
    expect(Math.max(...counts.values())).toBeLessThan(names.length * 0.1);
  });

  it("separates clearly different palettes", () => {
    expect(suggestPaletteName(["#173b59", "#41c2d0", "#c9f1ed", "#ff6426", "#f6e5d5"])).not.toBe(
      suggestPaletteName(["#b8124e", "#ff5f6d", "#ffa58c", "#ffc85c", "#ffe8c0"]),
    );
  });

  it("avoids names already taken, ignoring case", () => {
    const first = suggestPaletteName(OCEAN);
    expect(suggestPaletteName(OCEAN, [first.toUpperCase()])).toBe(`${first} 2`);
    expect(suggestPaletteName(OCEAN, [first, `${first} 2`])).toBe(`${first} 3`);
  });

  it("handles an empty palette", () => {
    expect(suggestPaletteName([])).toBe("New Palette");
  });

  it("stays within the palette name limit", () => {
    for (const hexes of generatedPalettes(100)) {
      expect(suggestPaletteName(hexes).length).toBeLessThanOrEqual(80);
    }
  });
});

describe("suggestPairings", () => {
  it("returns valid colors, including a light and a dark option", () => {
    const pairings = suggestPairings("#ff6426");
    expect(pairings).toHaveLength(4);
    expect(pairings.every((hex) => normalizeHex(hex) === hex)).toBe(true);
    expect(contrastRatio(pairings[2], pairings[3])).toBeGreaterThan(4.5);
  });
});

describe("built-in content", () => {
  it("has a family and guidance for everything colorFamilyOf can return", () => {
    for (const slug of COLOR_FAMILY_SLUGS) {
      expect(COLOR_FAMILIES.some((family) => family.slug === slug)).toBe(true);
      expect(MEANING_GUIDANCE[slug].culturalContext).toMatch(/vary by audience and culture/);
    }
  });

  it("has unique, valid palette ideas", () => {
    expect(PALETTE_IDEA_CATALOG.length).toBeGreaterThanOrEqual(40);
    expect(new Set(PALETTE_IDEA_CATALOG.map((idea) => idea.slug)).size).toBe(
      PALETTE_IDEA_CATALOG.length,
    );
    for (const idea of PALETTE_IDEA_CATALOG) {
      expect(idea.colors.every((hex) => normalizeHex(hex) === hex)).toBe(true);
      expect(idea.tags.length).toBeGreaterThan(0);
    }
  });

  it("has no two palette ideas with identical colors", () => {
    const keys = PALETTE_IDEA_CATALOG.map((idea) => idea.colors.join());
    expect(new Set(keys).size).toBe(keys.length);
  });
});
