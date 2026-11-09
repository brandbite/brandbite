// -----------------------------------------------------------------------------
// @file: app/colors/color-meanings/[slug]/opengraph-image.tsx
// @purpose: Share image for one color meaning page.
// -----------------------------------------------------------------------------

import { normalizeHex, tailwindScale } from "@/lib/colors";
import { COLOR_FAMILIES } from "@/lib/colors/color-families";
import { getColorMeaning } from "@/lib/colors/content";
import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from "@/lib/seo/og-image";

export const alt = "Color meaning";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Built at deploy time for the built-in families; CMS entries render once and
// are cached for a day. Next.js needs a literal here.
export const revalidate = 86400;

export function generateStaticParams() {
  return COLOR_FAMILIES.map((family) => ({ slug: family.slug }));
}

type ImageProps = { params: Promise<{ slug: string }> };

export default async function Image({ params }: ImageProps) {
  const meaning = await getColorMeaning((await params).slug);
  if (!meaning) {
    return renderOgCard({ title: "Every color has a", accent: "story." });
  }
  const hex = normalizeHex(meaning.hex ?? "") ?? null;

  return renderOgCard({
    eyebrow: "Color meaning",
    title: `What ${meaning.name.toLowerCase()}`,
    accent: "means.",
    subtitle: meaning.associations.slice(0, 4).join(", "),
    swatches: hex ? tailwindScale(hex).map((shade) => shade.hex) : undefined,
  });
}
