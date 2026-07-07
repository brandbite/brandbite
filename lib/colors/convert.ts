// -----------------------------------------------------------------------------
// @file: lib/colors/convert.ts
// @purpose: Hex <-> RGB <-> HSL conversions + normalization/clamping helpers.
//           Defensive by design: invalid input returns black rather than
//           throwing, so a bad paste in the UI can never crash a tool.
// -----------------------------------------------------------------------------

import type { Hex, HSL, PaletteColor, RGB } from "./types";

const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** Clamp to a 0–255 integer channel. */
export function clampChannel(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(255, Math.round(n)));
}

/** Clamp to a 0–100 percentage. */
export function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/** Wrap any hue into [0, 360). */
export function wrapHue(h: number): number {
  if (!Number.isFinite(h)) return 0;
  return ((h % 360) + 360) % 360;
}

/**
 * Normalize arbitrary hex-ish input to a canonical 6-digit lowercase hex.
 * - trims, lowercases, ensures a leading '#'
 * - expands 3-digit (#abc -> #aabbcc) and 4-digit (#abcd -> #aabbcc, alpha dropped)
 * - strips the alpha pair off 8-digit (#rrggbbaa -> #rrggbb)
 * Returns null when the input is not valid hex.
 */
export function normalizeHex(input: string): Hex | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim().toLowerCase();
  if (!HEX_RE.test(trimmed)) return null;

  const body = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;

  let rgbHex: string;
  if (body.length === 3) {
    rgbHex = body
      .split("")
      .map((c) => c + c)
      .join("");
  } else if (body.length === 4) {
    // #abcd -> expand RGB, drop alpha
    rgbHex = body
      .slice(0, 3)
      .split("")
      .map((c) => c + c)
      .join("");
  } else if (body.length === 8) {
    rgbHex = body.slice(0, 6);
  } else {
    rgbHex = body; // length 6
  }

  return `#${rgbHex}`;
}

export function hexToRgb(hex: string): RGB {
  const normalized = normalizeHex(hex);
  if (!normalized) return { r: 0, g: 0, b: 0 };
  const body = normalized.slice(1);
  return {
    r: parseInt(body.slice(0, 2), 16),
    g: parseInt(body.slice(2, 4), 16),
    b: parseInt(body.slice(4, 6), 16),
  };
}

export function rgbToHex(rgb: RGB): Hex {
  const toHex = (n: number) => clampChannel(n).toString(16).padStart(2, "0");
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

export function rgbToHsl(rgb: RGB): HSL {
  const r = clampChannel(rgb.r) / 255;
  const g = clampChannel(rgb.g) / 255;
  const b = clampChannel(rgb.b) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
  }

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return { h: wrapHue(h), s: clampPct(s * 100), l: clampPct(l * 100) };
}

export function hslToRgb(hsl: HSL): RGB {
  const h = wrapHue(hsl.h);
  const s = clampPct(hsl.s) / 100;
  const l = clampPct(hsl.l) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];

  return {
    r: clampChannel((rp + m) * 255),
    g: clampChannel((gp + m) * 255),
    b: clampChannel((bp + m) * 255),
  };
}

export function hexToHsl(hex: string): HSL {
  return rgbToHsl(hexToRgb(hex));
}

export function hslToHex(hsl: HSL): Hex {
  return rgbToHex(hslToRgb(hsl));
}

/** Build a full PaletteColor from any hex-ish string (defaults to black). */
export function toPaletteColor(hex: string, locked?: boolean): PaletteColor {
  const normalized = normalizeHex(hex) ?? "#000000";
  const rgb = hexToRgb(normalized);
  return { hex: normalized, rgb, hsl: rgbToHsl(rgb), locked };
}

/** Build a PaletteColor from an HSL value. */
export function paletteColorFromHsl(hsl: HSL, locked?: boolean): PaletteColor {
  const rgb = hslToRgb(hsl);
  return {
    hex: rgbToHex(rgb),
    rgb,
    hsl: { h: wrapHue(hsl.h), s: clampPct(hsl.s), l: clampPct(hsl.l) },
    locked,
  };
}
