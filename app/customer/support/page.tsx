// -----------------------------------------------------------------------------
// @file: app/customer/support/page.tsx
// @purpose: Support home for the customer dashboard — searchable guides
//           (content: lib/support/guides/customer.ts).
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

import { SupportCenter } from "@/components/dashboard/help/support-center";
import { getEffectiveGuides } from "@/lib/support/effective";

export const metadata: Metadata = { title: "Support" };

export default async function CustomerSupportPage() {
  const { guides } = await getEffectiveGuides("customer");
  return <SupportCenter role="customer" guides={guides} />;
}
