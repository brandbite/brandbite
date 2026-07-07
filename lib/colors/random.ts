// -----------------------------------------------------------------------------
// @file: lib/colors/random.ts
// @purpose: Random harmonious palette generation with lock-awareness, so the
//           generator can reroll only the unlocked swatches.
// -----------------------------------------------------------------------------

import { paletteColorFromHsl } from "./convert";
import { harmony } from "./harmony";
import type { HarmonyKind, HSL, Palette } from "./types";

const HARMONIES: HarmonyKind[] = [
  "analogous",
  "complementary",
  "triadic",
  "tetradic",
  "monochromatic",
];

function randomHsl(): HSL {
  return {
    h: Math.floor(Math.random() * 360),
    // Keep saturation/lightness in a pleasant mid-range so palettes read well.
    s: 55 + Math.floor(Math.random() * 35), // 55–90
    l: 45 + Math.floor(Math.random() * 25), // 45–70
  };
}

/** Pick a random harmony kind. */
export function randomHarmony(): HarmonyKind {
  return HARMONIES[Math.floor(Math.random() * HARMONIES.length)];
}

/**
 * Generate a fresh harmonious palette from a random base hue. If `kind` is
 * omitted a random harmony is chosen. Always returns at least `size` colors by
 * padding with monochromatic variations when the harmony yields fewer.
 */
export function randomPalette(size = 5, kind?: HarmonyKind): Palette {
  const chosen = kind ?? randomHarmony();
  const base = randomHsl();
  let colors = harmony(chosen, base);

  // Pad to the requested size with lightness variations of the base hue.
  let step = 12;
  while (colors.length < size) {
    colors = colors.concat(
      paletteColorFromHsl({ h: base.h, s: base.s, l: Math.max(10, Math.min(90, base.l + step)) }),
    );
    step = step > 0 ? -step - 6 : -step + 6;
  }

  return colors.slice(0, size);
}

/**
 * Regenerate a palette while preserving any color whose index is locked.
 * Unlocked slots are replaced by a fresh random palette's colors.
 */
export function regenerateUnlocked(current: Palette): Palette {
  const fresh = randomPalette(current.length);
  return current.map((c, i) => (c.locked ? c : { ...fresh[i], locked: false }));
}
