// -----------------------------------------------------------------------------
// @file: app/admin/support/page.tsx
// @purpose: Support home for the admin dashboard — searchable guides
//           (content: lib/support/guides/admin.ts).
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

import { SupportHub } from "@/components/support/support-hub";

export const metadata: Metadata = { title: "Support" };

export default function AdminSupportPage() {
  return <SupportHub role="admin" />;
}
