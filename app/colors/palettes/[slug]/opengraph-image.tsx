// -----------------------------------------------------------------------------
// @file: app/colors/palettes/[slug]/opengraph-image.tsx
// @purpose: Share image for one curated palette: its name and its colors.
// -----------------------------------------------------------------------------

import { normalizeHex } from "@/lib/colors";
import { getPaletteIdea } from "@/lib/colors/content";
import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from "@/lib/seo/og-image";

export const alt = "Color palette swatches";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

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
