import { describe, expect, it } from "vitest";

import {
  colorFamilyOf,
  COLOR_FAMILY_SLUGS,
  contrastRatio,
  describeColor,
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

  it("names a palette from its colors, the same way every time", () => {
    const name = suggestPaletteName(OCEAN);
    expect(name).toMatch(/^Deep (Ocean|Harbor|Horizon)$/);
    expect(suggestPaletteName(OCEAN)).toBe(name);
  });

  it("reflects a different palette", () => {
    expect(suggestPaletteName(["#ff6426", "#ff8a3d", "#ffb26b"])).toMatch(
      /(Sunset|Amber|Terracotta)$/,
    );
    expect(suggestPaletteName(["#ffe5ec", "#fff0f3", "#ffd6e0"])).toMatch(/^Soft /);
  });

  it("avoids names already taken, ignoring case", () => {
    const first = suggestPaletteName(OCEAN);
    expect(suggestPaletteName(OCEAN, [first.toUpperCase()])).toBe(`${first} 2`);
    expect(suggestPaletteName(OCEAN, [first, `${first} 2`])).toBe(`${first} 3`);
  });

  it("handles an empty palette", () => {
    expect(suggestPaletteName([])).toBe("New Palette");
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
