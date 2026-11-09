// -----------------------------------------------------------------------------
// @file: app/design-cost-calculator/opengraph-image.tsx
// @purpose: Share image for the design cost calculator.
// -----------------------------------------------------------------------------

import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from "@/lib/seo/og-image";

export const alt = "Graphic design cost calculator";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgCard({
    eyebrow: "Free tool",
    title: "What does design",
    accent: "really cost?",
    subtitle: "Freelancer vs agency vs in-house, with 2026 rates for the US and Europe.",
  });
}
