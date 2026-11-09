// -----------------------------------------------------------------------------
// @file: app/admin/support-content/new/page.tsx
// @purpose: Add a Support guide that exists only in the CMS.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

import { GuideEditor } from "@/components/admin/support/guide-editor";
import { isSupportRole } from "@/lib/support/admin";

export const metadata: Metadata = { title: "New guide · Support content" };

type Props = { searchParams: Promise<{ role?: string }> };

export default async function NewSupportGuidePage({ searchParams }: Props) {
  const { role } = await searchParams;
  return <GuideEditor role={role && isSupportRole(role) ? role : "customer"} slug={null} />;
}
