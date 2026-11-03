// -----------------------------------------------------------------------------
// @file: app/customer/support/[slug]/page.tsx
// @purpose: A single customer Support guide.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SupportGuideView } from "@/components/support/support-ui";
import { getGuide } from "@/lib/support";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide("customer", slug);
  return { title: guide ? `${guide.title} · Support` : "Support" };
}

export default async function CustomerSupportGuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = getGuide("customer", slug);
  if (!guide) notFound();

  return <SupportGuideView role="customer" guide={guide} />;
}
