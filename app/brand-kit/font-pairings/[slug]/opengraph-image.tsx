// -----------------------------------------------------------------------------
// @file: app/brand-kit/font-pairings/[slug]/opengraph-image.tsx
// @purpose: Share image for one font pairing.
// -----------------------------------------------------------------------------

import { FONT_PAIRINGS, getFont, getPairing } from "@/lib/brand-kit/fonts";
import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from "@/lib/seo/og-image";

export const alt = "Font pairing";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return FONT_PAIRINGS.map((pairing) => ({ slug: pairing.slug }));
}

type ImageProps = { params: Promise<{ slug: string }> };

export default async function Image({ params }: ImageProps) {
  const pairing = getPairing((await params).slug);
  if (!pairing) return renderOgCard({ title: "Font", accent: "pairings." });
  return renderOgCard({
    eyebrow: "Font pairing",
    title: `${getFont(pairing.heading).name} +`,
    accent: getFont(pairing.body).name,
    subtitle: pairing.bestFor,
  });
}
