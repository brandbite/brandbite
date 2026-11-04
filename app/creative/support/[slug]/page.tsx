// -----------------------------------------------------------------------------
// @file: app/creative/support/[slug]/page.tsx
// @purpose: A single creative Support guide.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GuideView } from "@/components/dashboard/help/guide-view";
import { getGuide } from "@/lib/support";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide("creative", slug);
  return { title: guide ? `${guide.title} · Support` : "Support" };
}

export default async function CreativeSupportGuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = getGuide("creative", slug);
  if (!guide) notFound();

  return <GuideView role="creative" guide={guide} />;
}
