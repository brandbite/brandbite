// -----------------------------------------------------------------------------
// @file: app/admin/support/page.tsx
// @purpose: Support home for the admin dashboard — searchable guides
//           (content: lib/support/guides/admin.ts).
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

import { SupportHub } from "@/components/support/support-hub";
import { getEffectiveGuides } from "@/lib/support/effective";

export const metadata: Metadata = { title: "Support" };

export default async function AdminSupportPage() {
  const { guides } = await getEffectiveGuides("admin");
  return <SupportHub role="admin" guides={guides} />;
}
