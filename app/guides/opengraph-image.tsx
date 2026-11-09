// -----------------------------------------------------------------------------
// @file: app/guides/opengraph-image.tsx
// @purpose: Share image for the guides hub.
// -----------------------------------------------------------------------------

import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from "@/lib/seo/og-image";

export const alt = "brandbite guides";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgCard({
    eyebrow: "Guides",
    title: "Guides for better",
    accent: "design work.",
    subtitle: "Briefs, brand colors, fonts and hiring design, explained.",
  });
}
