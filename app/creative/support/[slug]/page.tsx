// -----------------------------------------------------------------------------
// @file: app/creative/support/[slug]/page.tsx
// @purpose: A single creative Support guide.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { GuideView } from "@/components/dashboard/help/guide-view";
import { supportBasePath } from "@/lib/support";
import { getEffectiveGuide } from "@/lib/support/effective";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { guide } = await getEffectiveGuide("creative", slug);
  return { title: guide ? `${guide.title} · Support` : "Support" };
}

export default async function CreativeSupportGuidePage({ params }: Props) {
  const { slug } = await params;
  const { guide, hidden, all } = await getEffectiveGuide("creative", slug);
  // A guide an admin hid: the page's "?" link may still point here.
  if (hidden) redirect(supportBasePath("creative"));
  if (!guide) notFound();

  return <GuideView role="creative" guide={guide} guides={all} />;
}
