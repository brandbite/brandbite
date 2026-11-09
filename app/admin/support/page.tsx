// -----------------------------------------------------------------------------
// @file: app/admin/support/page.tsx
// @purpose: Support home for the admin dashboard — searchable guides
//           (content: lib/support/guides/admin.ts plus Support content edits).
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

import { SupportCenter } from "@/components/dashboard/help/support-center";
import { getCurrentUser } from "@/lib/auth";
import { isSiteOwnerRole } from "@/lib/roles";
import { getEffectiveGuides } from "@/lib/support/effective";

export const metadata: Metadata = { title: "Support" };

export default async function AdminSupportPage() {
  const [{ guides }, user] = await Promise.all([getEffectiveGuides("admin"), getCurrentUser()]);
  // Owner-only guides mirror ownerOnly nav items — SITE_ADMINs don't see them.
  const isSiteOwner = !!user && isSiteOwnerRole(user.role);
  return <SupportCenter role="admin" guides={guides} isSiteOwner={isSiteOwner} />;
}
