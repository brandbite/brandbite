// -----------------------------------------------------------------------------
// @file: app/brief-generator/opengraph-image.tsx
// @purpose: Share image for the creative brief generator.
// -----------------------------------------------------------------------------

import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from "@/lib/seo/og-image";

export const alt = "Free creative brief generator";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgCard({
    eyebrow: "Free tool",
    title: "Creative brief",
    accent: "generator.",
    subtitle: "Answer a few questions. Copy, download or save your brief as a PDF.",
  });
}
