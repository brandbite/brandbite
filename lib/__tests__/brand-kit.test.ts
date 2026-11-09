import { describe, expect, it } from "vitest";

import { FONT_PAIRINGS, FONTS, getFont, pairingsFor, PERSONALITIES } from "@/lib/brand-kit/fonts";
import { DEFAULT_KIT, kitFromParams, kitToParams } from "@/lib/brand-kit/kit-url";
import { brandKitCss, brandPalette, paletteIsReadable, recipeCount } from "@/lib/brand-kit/palette";

describe("fonts and pairings", () => {
  it("only pairs known fonts, with unique slugs and two different fonts", () => {
    const slugs = FONT_PAIRINGS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const pairing of FONT_PAIRINGS) {
      expect(() => getFont(pairing.heading)).not.toThrow();
      expect(() => getFont(pairing.body)).not.toThrow();
      expect(pairing.heading).not.toBe(pairing.body);
      expect(pairing.why.length).toBeGreaterThan(60);
    }
  });

  it("offers at least three pairings for every personality", () => {
    for (const personality of PERSONALITIES) {
      expect(pairingsFor(personality).length, personality).toBeGreaterThanOrEqual(3);
    }
  });

  it("uses every declared font somewhere", () => {
    const used = new Set(FONT_PAIRINGS.flatMap((p) => [p.heading, p.body]));
    for (const font of FONTS) expect(used.has(font.id), font.id).toBe(true);
  });
});

describe("brand palette", () => {
  it("keeps the base color as primary and returns five roles", () => {
    const palette = brandPalette("#3b5bdb", "Modern");
    expect(palette.map((c) => c.role)).toEqual(["primary", "secondary", "accent", "dark", "light"]);
    expect(palette[0].hex).toBe("#3b5bdb");
  });

  it("is deterministic and readable for every personality and variant", () => {
    for (const personality of PERSONALITIES) {
      for (let v = 0; v < recipeCount(personality); v++) {
        for (const base of ["#ff6426", "#808080", "#000000", "#ffffff", "#00b894"]) {
          const a = brandPalette(base, personality, v);
          expect(a).toEqual(brandPalette(base, personality, v));
          expect(paletteIsReadable(a), `${personality} ${v} ${base}`).toBe(true);
          for (const c of a) expect(c.hex).toMatch(/^#[0-9a-f]{6}$/);
        }
      }
    }
  });

  it("falls back for an invalid base color", () => {
    expect(brandPalette("nope", "Bold")[0].hex).toBe("#ff6426");
  });

  it("exports CSS variables", () => {
    const css = brandKitCss(brandPalette("#3b5bdb", "Modern"), "Space Grotesk", "Inter");
    expect(css).toContain("--brand-primary: #3b5bdb;");
    expect(css).toContain('--font-heading: "Space Grotesk"');
  });
});

describe("kit links", () => {
  it("round-trips a kit through the URL", () => {
    const kit = {
      name: "Northwind",
      tagline: "See what sells",
      color: "#1f3a5f",
      personality: "Classic" as const,
      pairing: "playfair-display-and-lato",
      variant: 1,
    };
    expect(kitFromParams(kitToParams(kit))).toEqual(kit);
  });

  it("ignores bad values", () => {
    const kit = kitFromParams(new URLSearchParams("color=zzz&style=Weird&fonts=nope&v=-4"));
    expect(kit.color).toBe(DEFAULT_KIT.color);
    expect(kit.personality).toBe(DEFAULT_KIT.personality);
    expect(pairingsFor(kit.personality).map((p) => p.slug)).toContain(kit.pairing);
    expect(kit.variant).toBe(0);
  });
});
