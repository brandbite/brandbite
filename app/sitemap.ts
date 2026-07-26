// -----------------------------------------------------------------------------
// @file: app/sitemap.ts
// @purpose: Sitemap configuration for search engine indexing
// -----------------------------------------------------------------------------

import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

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
    ...["/faq", "/contact", "/coming-soon"].map((path) => ({
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
    ].map((path) => ({
      url: `${baseUrl}${path}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
