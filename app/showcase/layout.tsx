// -----------------------------------------------------------------------------
// @file: app/showcase/layout.tsx
// @purpose: Metadata-only server wrapper for the "use client" showcase grid.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Showcase",
  description: "Portfolio of creative work delivered through Brandbite.",
};

export default function ShowcaseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
