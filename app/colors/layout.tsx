// -----------------------------------------------------------------------------
// @file: app/colors/layout.tsx
// @purpose: Metadata-only server wrapper for the public color-tools section.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Color Tools",
  description:
    "Free color tools from Brandbite — an interactive color wheel and a palette generator with image color extraction. Build, copy, and save harmonious palettes.",
};

export default function ColorsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
