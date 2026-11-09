// -----------------------------------------------------------------------------
// @file: app/admin/support-content/[role]/[slug]/page.tsx
// @purpose: Edit one Support guide (see components/admin/support/guide-editor).
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GuideEditor } from "@/components/admin/support/guide-editor";
import { isGuideOwner } from "@/lib/support/admin";

export const metadata: Metadata = { title: "Edit guide · Support content" };

type Props = { params: Promise<{ role: string; slug: string }> };

export default async function EditSupportGuidePage({ params }: Props) {
  const { role, slug } = await params;
  if (!isGuideOwner(role)) notFound();
  return <GuideEditor role={role} slug={slug} />;
}
