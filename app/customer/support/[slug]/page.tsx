// -----------------------------------------------------------------------------
// @file: app/customer/support/[slug]/page.tsx
// @purpose: A single customer Support guide.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { GuideView } from "@/components/dashboard/help/guide-view";
import { supportBasePath } from "@/lib/support";
import { getEffectiveGuide } from "@/lib/support/effective";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { guide } = await getEffectiveGuide("customer", slug);
  return { title: guide ? `${guide.title} · Support` : "Support" };
}

export default async function CustomerSupportGuidePage({ params }: Props) {
  const { slug } = await params;
  const { guide, hidden, all } = await getEffectiveGuide("customer", slug);
  // A guide an admin hid: the page's "?" link may still point here.
  if (hidden) redirect(supportBasePath("customer"));
  if (!guide) notFound();

  return <GuideView role="customer" guide={guide} guides={all} />;
}
