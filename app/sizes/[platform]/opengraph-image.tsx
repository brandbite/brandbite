// -----------------------------------------------------------------------------
// @file: app/sizes/[platform]/opengraph-image.tsx
// @purpose: Share image for one platform's size page.
// -----------------------------------------------------------------------------

import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from "@/lib/seo/og-image";
import { getSizePlatform, SIZE_PLATFORMS } from "@/lib/sizes";

export const alt = "Image size guide";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return SIZE_PLATFORMS.map((platform) => ({ platform: platform.slug }));
}

type ImageProps = { params: Promise<{ platform: string }> };

export default async function Image({ params }: ImageProps) {
  const platform = getSizePlatform((await params).platform);
  if (!platform) return renderOgCard({ title: "Image", accent: "sizes." });
  const year = platform.checkedOn.slice(0, 4);

  const popular = platform.formats.filter((format) => format.popular).slice(0, 3);
  return renderOgCard({
    eyebrow: `Size guide ${year}`,
    title: platform.headline,
    accent: "sizes.",
    subtitle: popular
      .map((format) => `${format.name} ${format.width}×${format.height}`)
      .join("  ·  "),
  });
}
