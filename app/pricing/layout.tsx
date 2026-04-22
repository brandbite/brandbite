// -----------------------------------------------------------------------------
// @file: app/pricing/layout.tsx
// @purpose: Metadata-only server wrapper for the "use client" pricing page.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Plans & Pricing",
  description: "Subscription plans and one-time token top-ups for Brandbite creative-as-a-service.",
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
