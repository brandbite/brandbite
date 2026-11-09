// -----------------------------------------------------------------------------
// @file: app/colors/palettes/[slug]/opengraph-image.tsx
// @purpose: Share image for one curated palette: its name and its colors.
// -----------------------------------------------------------------------------

import { normalizeHex } from "@/lib/colors";
import { getPaletteIdea } from "@/lib/colors/content";
import { PALETTE_IDEA_CATALOG } from "@/lib/colors/palette-idea-catalog";
import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from "@/lib/seo/og-image";

export const alt = "Color palette swatches";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Built at deploy time for the built-in palettes; CMS palettes render once and
// are cached for a day. Next.js needs a literal here.
export const revalidate = 86400;

export function generateStaticParams() {
  return PALETTE_IDEA_CATALOG.map((idea) => ({ slug: idea.slug }));
}

type ImageProps = { params: Promise<{ slug: string }> };

export default async function Image({ params }: ImageProps) {
  const idea = await getPaletteIdea((await params).slug);
  if (!idea) {
    return renderOgCard({ title: "Color palette", accent: "ideas." });
  }
  const colors = idea.colors.map((hex) => normalizeHex(hex)).filter((hex): hex is string => !!hex);

  return renderOgCard({
    eyebrow: "Color palette",
    title: idea.title,
    subtitle: colors.map((hex) => hex.toUpperCase()).join("  ·  "),
    swatches: colors,
  });
}
