// -----------------------------------------------------------------------------
// @file: app/sizes/opengraph-image.tsx
// @purpose: Share image for the size guide hub.
// -----------------------------------------------------------------------------

import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from "@/lib/seo/og-image";
import { SIZE_PLATFORMS } from "@/lib/sizes";

export const alt = "Social media image size guide";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgCard({
    eyebrow: "Size guide",
    title: "Social media image",
    accent: "sizes.",
    subtitle: SIZE_PLATFORMS.map((platform) => platform.name).join(" · "),
  });
}
