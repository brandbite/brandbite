// -----------------------------------------------------------------------------
// @file: app/sitemap.ts
// @purpose: Sitemap configuration for search engine indexing
// -----------------------------------------------------------------------------

import type { MetadataRoute } from "next";

import { COLOR_FAMILIES } from "@/lib/colors/color-families";
import { getPaletteIdeas } from "@/lib/colors/content";
import { NAMED_COLORS } from "@/lib/colors/named-colors";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const paletteIdeas = await getPaletteIdeas();

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    // Public marketing pages (2026 redesign)
    ...["/faq", "/contact", "/about", "/terms", "/privacy", "/blog", "/meet"].map((path) => ({
      url: `${baseUrl}${path}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    // Color tools — free public utilities, a meaningful organic-search surface.
    ...[
      "/colors",
      "/colors/tailwind-color-generator",
      "/colors/color-palette-generator",
      "/colors/color-wheel",
      "/colors/color-palette-ideas",
      "/colors/color-meanings",
      "/colors/contrast-checker",
      "/colors/image-to-palette",
      "/colors/hex",
      ...NAMED_COLORS.map((color) => `/colors/hex/${color.hex.slice(1)}`),
      ...paletteIdeas.map((idea) => `/colors/palettes/${idea.slug}`),
      ...COLOR_FAMILIES.map((family) => `/colors/color-meanings/${family.slug}`),
    ].map((path) => ({
      url: `${baseUrl}${path}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
