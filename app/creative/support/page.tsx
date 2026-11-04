// -----------------------------------------------------------------------------
// @file: app/creative/support/page.tsx
// @purpose: Support home for the creative dashboard — searchable guides
//           (content: lib/support/guides/creative.ts).
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

import { SupportCenter } from "@/components/dashboard/help/support-center";

export const metadata: Metadata = { title: "Support" };

export default function CreativeSupportPage() {
  return <SupportCenter role="creative" />;
}
