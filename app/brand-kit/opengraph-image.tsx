// -----------------------------------------------------------------------------
// @file: app/brand-kit/opengraph-image.tsx
// @purpose: Share image for the brand kit generator and font pairings hub.
// -----------------------------------------------------------------------------

import { brandPalette } from "@/lib/brand-kit/palette";
import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from "@/lib/seo/og-image";

export const alt = "Free brand kit generator";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgCard({
    eyebrow: "Free tool",
    title: "Brand kit",
    accent: "generator.",
    subtitle: "One color in. A palette, fonts and previews out.",
    swatches: brandPalette("#ff6426", "Playful").map((color) => color.hex),
  });
}
