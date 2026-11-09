// -----------------------------------------------------------------------------
// @file: app/sitemap.ts
// @purpose: Sitemap for search engines: public marketing pages, Color Studio
//           tools and content, and published blog posts.
//
//           Pages only get `lastModified` when we know when they really
//           changed (CMS rows). Stamping every URL with "now", as before,
//           taught Google to ignore the field. Sign-in, holding pages and
//           noindex pages stay out, and so does /news: its pages render in the
//           browser only, so crawlers get no content until they move to the server.
// -----------------------------------------------------------------------------

import type { MetadataRoute } from "next";

import { FONT_PAIRINGS } from "@/lib/brand-kit/fonts";
import { COLOR_FAMILIES } from "@/lib/colors/color-families";
import { getPaletteIdeas } from "@/lib/colors/content";
import { NAMED_COLORS } from "@/lib/colors/named-colors";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/seo/structured-data";
import { SIZE_PLATFORMS } from "@/lib/sizes";

// Rebuilt at most hourly, so newly published posts show up without a deploy.
export const revalidate = 3600;

type Entry = MetadataRoute.Sitemap[number];

const MARKETING_PATHS = ["/about", "/faq", "/contact", "/meet", "/blog"];
const LEGAL_PATHS = ["/terms", "/privacy", "/accessibility"];
const COLOR_TOOL_PATHS = [
  "/colors",
  "/colors/color-palette-generator",
  "/colors/tailwind-color-generator",
  "/colors/color-wheel",
  "/colors/contrast-checker",
  "/colors/image-to-palette",
  "/colors/color-palette-ideas",
  "/colors/color-meanings",
  "/colors/hex",
];

function entry(path: string, priority: number, lastModified?: Date | null): Entry {
  return {
    url: absoluteUrl(path),
    priority,
    ...(lastModified ? { lastModified } : {}),
  };
}

/** Published blog posts; an unreachable database must not break the sitemap. */
async function publishedPosts() {
  try {
    return await prisma.blogPost.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
    });
  } catch (err) {
    console.error("[sitemap] blog posts error", err);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [paletteIdeas, posts] = await Promise.all([getPaletteIdeas(), publishedPosts()]);

  return [
    entry("/", 1),
    ...MARKETING_PATHS.map((path) => entry(path, 0.8)),
    ...COLOR_TOOL_PATHS.map((path) => entry(path, 0.8)),
    entry("/sizes", 0.8),
    entry("/brief-generator", 0.8),
    entry("/brand-kit", 0.8),
    entry("/design-cost-calculator", 0.8),
    entry("/brand-kit/font-pairings", 0.8),
    ...FONT_PAIRINGS.map((pairing) => entry(`/brand-kit/font-pairings/${pairing.slug}`, 0.6)),
    ...SIZE_PLATFORMS.map((platform) => entry(`/sizes/${platform.slug}`, 0.8)),
    ...posts.map((post) => entry(`/blog/${post.slug}`, 0.7, post.updatedAt)),
    ...paletteIdeas.map((idea) => entry(`/colors/palettes/${idea.slug}`, 0.6)),
    ...COLOR_FAMILIES.map((family) => entry(`/colors/color-meanings/${family.slug}`, 0.6)),
    ...NAMED_COLORS.map((color) => entry(`/colors/hex/${color.hex.slice(1)}`, 0.5)),
    ...LEGAL_PATHS.map((path) => entry(path, 0.3)),
  ];
}
