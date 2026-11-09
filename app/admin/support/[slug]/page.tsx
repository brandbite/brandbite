// -----------------------------------------------------------------------------
// @file: app/admin/support/[slug]/page.tsx
// @purpose: A single admin Support guide.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { GuideView } from "@/components/dashboard/help/guide-view";
import { getCurrentUser } from "@/lib/auth";
import { isSiteOwnerRole } from "@/lib/roles";
import { supportBasePath } from "@/lib/support";
import { getEffectiveGuide } from "@/lib/support/effective";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { guide } = await getEffectiveGuide("admin", slug);
  return { title: guide ? `${guide.title} · Support` : "Support" };
}

export default async function AdminSupportGuidePage({ params }: Props) {
  const { slug } = await params;
  const { guide, hidden, all } = await getEffectiveGuide("admin", slug);
  if (hidden) redirect(supportBasePath("admin"));
  if (!guide) notFound();

  // Owner-only guides mirror ownerOnly nav items — hide them from SITE_ADMIN.
  const user = await getCurrentUser();
  const isSiteOwner = !!user && isSiteOwnerRole(user.role);
  if (guide.ownerOnly && !isSiteOwner) notFound();

  return <GuideView role="admin" guide={guide} guides={all} isSiteOwner={isSiteOwner} />;
}
