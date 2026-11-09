// -----------------------------------------------------------------------------
// @file: app/opengraph-image.tsx
// @purpose: Default share image for every page that doesn't make its own.
// -----------------------------------------------------------------------------

import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from "@/lib/seo/og-image";

export const alt = "brandbite: creative that hits different";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgCard({
    title: "Creative that hits",
    accent: "different.",
    subtitle: "Unlimited creative requests, top creative talent, one simple subscription.",
  });
}
