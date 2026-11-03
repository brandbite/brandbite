// -----------------------------------------------------------------------------
// @file: app/customer/support/page.tsx
// @purpose: Support home for the customer dashboard — searchable guides
//           (content: lib/support/guides/customer.ts).
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

import { SupportHub } from "@/components/support/support-hub";

export const metadata: Metadata = { title: "Support" };

export default function CustomerSupportPage() {
  return <SupportHub role="customer" />;
}
