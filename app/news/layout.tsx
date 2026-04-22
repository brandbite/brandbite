// -----------------------------------------------------------------------------
// @file: app/news/layout.tsx
// @purpose: Metadata-only server wrapper for the "use client" news listing.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "News",
  description: "Company announcements, product updates, and industry news from Brandbite.",
};

export default function NewsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
