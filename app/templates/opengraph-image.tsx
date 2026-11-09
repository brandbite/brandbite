// -----------------------------------------------------------------------------
// @file: app/templates/opengraph-image.tsx
// @purpose: Share image for the templates hub.
// -----------------------------------------------------------------------------

import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from "@/lib/seo/og-image";

export const alt = "Free templates from brandbite";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgCard({
    eyebrow: "Free templates",
    title: "Free templates for",
    accent: "better briefs.",
    subtitle: "Creative brief · Content calendar · Brand guidelines",
  });
}
