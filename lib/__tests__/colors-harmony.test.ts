import { describe, expect, it } from "vitest";

import {
  harmonyOfSize,
  regenerateWithHarmony,
  tailwindScale,
  tailwindScaleToThemeV4,
  toPaletteColor,
  type HarmonyKind,
  type HSL,
} from "@/lib/colors";

const BASE: HSL = { h: 200, s: 70, l: 50 };
const KINDS: HarmonyKind[] = ["complementary", "analogous", "triadic", "tetradic", "monochromatic"];

/** Smallest angular distance between two hues. */
function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function seeded(): () => number {
  let state = 0.137;
  return () => {
    state = (state * 9301 + 0.49297) % 1;
    return state;
  };
}

describe("harmonyOfSize", () => {
  it.each(KINDS)("returns exactly the requested size for %s", (kind) => {
    for (const size of [1, 2, 3, 5, 8, 12]) {
      expect(harmonyOfSize(kind, BASE, size)).toHaveLength(size);
    }
  });

  it("stays on the rule's hues when a fixed rule is padded", () => {
    for (const color of harmonyOfSize("complementary", BASE, 6)) {
      const onRule = hueDistance(color.hsl.h, 200) < 1 || hueDistance(color.hsl.h, 20) < 1;
      expect(onRule).toBe(true);
    }
  });

  it("keeps large analogous palettes within 60 degrees of the base", () => {
    for (const color of harmonyOfSize("analogous", BASE, 12)) {
      expect(hueDistance(color.hsl.h, BASE.h)).toBeLessThanOrEqual(60.001);
    }
  });

  it("keeps monochromatic palettes on one hue", () => {
    for (const color of harmonyOfSize("monochromatic", BASE, 8)) {
      expect(color.hsl.h).toBe(BASE.h);
    }
  });
});

describe("regenerateWithHarmony", () => {
  const palette = ["#173b59", "#41c2d0", "#c9f1ed", "#ff6426", "#f6e5d5"].map((hex) =>
    toPaletteColor(hex, false),
  );

  it("keeps locked colors in their slots", () => {
    const current = palette.map((c, i) => (i === 1 ? { ...c, locked: true } : c));
    for (const kind of KINDS) {
      const next = regenerateWithHarmony(current, kind, seeded());
      expect(next).toHaveLength(current.length);
      expect(next[1]).toEqual(current[1]);
    }
  });

  it("builds unlocked colors around the first locked color", () => {
    const locked = { ...toPaletteColor("#41c2d0"), locked: true };
    const next = regenerateWithHarmony([palette[0], locked, palette[2]], "analogous", seeded());
    for (const color of next) {
      expect(hueDistance(color.hsl.h, locked.hsl.h)).toBeLessThanOrEqual(61);
    }
  });

  it("does not duplicate a locked color into another slot", () => {
    const locked = { ...toPaletteColor("#41c2d0"), locked: true };
    const next = regenerateWithHarmony([locked, ...palette.slice(1)], "triadic", seeded());
    for (const color of next.slice(1)) expect(color.hex).not.toBe(locked.hex);
  });

  it("is deterministic for a given random source", () => {
    expect(regenerateWithHarmony(palette, "triadic", seeded())).toEqual(
      regenerateWithHarmony(palette, "triadic", seeded()),
    );
  });

  it("returns the same palette when everything is locked", () => {
    const allLocked = palette.map((c) => ({ ...c, locked: true }));
    expect(regenerateWithHarmony(allLocked, "triadic")).toBe(allLocked);
  });
});

describe("tailwindScaleToThemeV4", () => {
  it("emits a v4 @theme block with --color- variables", () => {
    const output = tailwindScaleToThemeV4("Brand Orange", tailwindScale("#ff6426", 500));
    expect(output.startsWith("@theme {\n")).toBe(true);
    expect(output).toContain("  --color-brand-orange-500: #ff6426;");
    expect(output.match(/--color-brand-orange-\d+:/g)).toHaveLength(11);
  });
});
