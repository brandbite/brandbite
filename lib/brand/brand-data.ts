// -----------------------------------------------------------------------------
// @file: lib/brand/brand-data.ts
// @purpose: Shapes of the colors and fonts kept as JSON on a Brand row, and
//           readers that accept whatever is stored. No server imports, so
//           pages and the AI context builder share the types.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

import { parseOpaqueHex } from "@/lib/colors/convert";

export const BRAND_COLOR_ROLES = ["primary", "secondary", "accent", "background", "text"] as const;
export type BrandColorRole = (typeof BRAND_COLOR_ROLES)[number];

export const BRAND_FONT_ROLES = ["heading", "body", "accent"] as const;
export type BrandFontRole = (typeof BRAND_FONT_ROLES)[number];

export type BrandColor = {
  id: string;
  /** Always "#rrggbb". */
  hex: string;
  name?: string;
  role?: BrandColorRole;
  /** Print values, as the customer wrote them. */
  cmyk?: string;
  pantone?: string;
};

export type BrandFont = {
  id: string;
  name: string;
  role?: BrandFontRole;
  /** Where to get it (Google Fonts, the foundry's page). */
  url?: string;
};

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

/** Reads Brand.colors. Entries without a valid hex are dropped. */
export function readBrandColors(raw: unknown): BrandColor[] {
  if (!Array.isArray(raw)) return [];
  const colors: BrandColor[] = [];
  raw.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const row = entry as Record<string, unknown>;
    const hex = typeof row.hex === "string" ? parseOpaqueHex(row.hex) : null;
    if (!hex) return;
    const color: BrandColor = { id: text(row.id, 64) ?? `color-${index}`, hex };
    const name = text(row.name, 60);
    const role = oneOf(row.role, BRAND_COLOR_ROLES);
    const cmyk = text(row.cmyk, 40);
    const pantone = text(row.pantone, 40);
    if (name) color.name = name;
    if (role) color.role = role;
    if (cmyk) color.cmyk = cmyk;
    if (pantone) color.pantone = pantone;
    colors.push(color);
  });
  return colors;
}

/** Reads Brand.fonts. Entries without a name are dropped. */
export function readBrandFonts(raw: unknown): BrandFont[] {
  if (!Array.isArray(raw)) return [];
  const fonts: BrandFont[] = [];
  raw.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const row = entry as Record<string, unknown>;
    const name = text(row.name, 80);
    if (!name) return;
    const font: BrandFont = { id: text(row.id, 64) ?? `font-${index}`, name };
    const role = oneOf(row.role, BRAND_FONT_ROLES);
    const url = text(row.url, 500);
    if (role) font.role = role;
    if (url && /^https:\/\//i.test(url)) font.url = url;
    fonts.push(font);
  });
  return fonts;
}
