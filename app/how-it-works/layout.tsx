// -----------------------------------------------------------------------------
// @file: app/how-it-works/layout.tsx
// @purpose: Metadata-only server wrapper for the "use client" how-it-works page.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How it works",
  description: "How Brandbite's creative-as-a-service subscription works, end to end.",
};

export default function HowItWorksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
