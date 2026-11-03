// -----------------------------------------------------------------------------
// @file: app/creative/support/page.tsx
// @purpose: Support home for the creative dashboard — searchable guides
//           (content: lib/support/guides/creative.ts).
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

import { SupportHub } from "@/components/support/support-hub";

export const metadata: Metadata = { title: "Support" };

export default function CreativeSupportPage() {
  return <SupportHub role="creative" />;
}
