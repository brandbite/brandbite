// -----------------------------------------------------------------------------
// @file: app/admin/support/[slug]/page.tsx
// @purpose: A single admin Support guide.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SupportGuideView } from "@/components/support/support-ui";
import { getCurrentUser } from "@/lib/auth";
import { isSiteOwnerRole } from "@/lib/roles";
import { getGuide } from "@/lib/support";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide("admin", slug);
  return { title: guide ? `${guide.title} · Support` : "Support" };
}

export default async function AdminSupportGuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = getGuide("admin", slug);
  if (!guide) notFound();

  // Owner-only guides mirror ownerOnly nav items — hide them from SITE_ADMIN.
  if (guide.ownerOnly) {
    const user = await getCurrentUser();
    if (!user || !isSiteOwnerRole(user.role)) notFound();
  }

  return <SupportGuideView role="admin" guide={guide} />;
}
