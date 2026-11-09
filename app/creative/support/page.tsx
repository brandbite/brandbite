// -----------------------------------------------------------------------------
// @file: app/creative/support/page.tsx
// @purpose: Support home for the creative dashboard — searchable guides
//           (content: lib/support/guides/creative.ts).
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

import { SupportCenter } from "@/components/dashboard/help/support-center";
import { getEffectiveGuides } from "@/lib/support/effective";

export const metadata: Metadata = { title: "Support" };

export default async function CreativeSupportPage() {
  const { guides } = await getEffectiveGuides("creative");
  return <SupportCenter role="creative" guides={guides} />;
}
