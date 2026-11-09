// -----------------------------------------------------------------------------
// @file: app/guides/[slug]/opengraph-image.tsx
// @purpose: Share image for one public guide. Built at deploy time for the
//           guides in code; CMS-only guides render once and are cached a day.
// -----------------------------------------------------------------------------

import { guideMeta, PUBLIC_GUIDES, readMinutes } from "@/lib/guides";
import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from "@/lib/seo/og-image";
import { getEffectiveGuide } from "@/lib/support/effective";

export const alt = "brandbite guide";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Next.js needs a literal here.
export const revalidate = 86400;

export function generateStaticParams() {
  return PUBLIC_GUIDES.map((guide) => ({ slug: guide.slug }));
}

type ImageProps = { params: Promise<{ slug: string }> };

export default async function Image({ params }: ImageProps) {
  const { guide } = await getEffectiveGuide("public", (await params).slug);
  if (!guide) return renderOgCard({ title: "brandbite", accent: "guides." });
  return renderOgCard({
    eyebrow: `Guide · ${readMinutes(guide)} min read`,
    title: guide.title,
    subtitle: guideMeta(guide.slug).tool.blurb,
  });
}
