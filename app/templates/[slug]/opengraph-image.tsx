// -----------------------------------------------------------------------------
// @file: app/templates/[slug]/opengraph-image.tsx
// @purpose: Share image for one free template.
// -----------------------------------------------------------------------------

import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from "@/lib/seo/og-image";
import { getTemplate, TEMPLATES } from "@/lib/templates";

export const alt = "Free template from brandbite";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return TEMPLATES.map((template) => ({ slug: template.slug }));
}

type ImageProps = { params: Promise<{ slug: string }> };

export default async function Image({ params }: ImageProps) {
  const template = getTemplate((await params).slug);
  if (!template) return renderOgCard({ title: "Free", accent: "templates." });
  return renderOgCard({
    eyebrow: `Free ${template.format} template`,
    title: template.title,
    subtitle: template.opensIn.join(" · "),
  });
}
