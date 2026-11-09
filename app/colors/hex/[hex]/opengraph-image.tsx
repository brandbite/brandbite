// -----------------------------------------------------------------------------
// @file: app/colors/hex/[hex]/opengraph-image.tsx
// @purpose: Share image for one color: its name, HEX code and shade ramp.
// -----------------------------------------------------------------------------

import { describeColor, formatHex, parseOpaqueHex, tailwindScale } from "@/lib/colors";
import { findNamedColor } from "@/lib/colors/named-colors";
import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from "@/lib/seo/og-image";

export const alt = "Color swatch and shades";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

type ImageProps = { params: Promise<{ hex: string }> };

export default async function Image({ params }: ImageProps) {
  // proxy.ts answers 404 for invalid values before this runs; black is a safe fallback.
  const hex = parseOpaqueHex((await params).hex) ?? "#000000";
  const name = findNamedColor(hex)?.name ?? describeColor(hex).name;
  const shades = tailwindScale(hex).map((shade) => shade.hex);

  return renderOgCard({
    eyebrow: "Color",
    title: name,
    accent: formatHex(hex),
    subtitle: "Shades, contrast, pairings and meaning.",
    swatches: shades,
  });
}
