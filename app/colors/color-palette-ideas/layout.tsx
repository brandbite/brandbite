// -----------------------------------------------------------------------------
// @file: app/colors/color-palette-ideas/layout.tsx
// @purpose: Metadata-only server wrapper for the Palette Ideas gallery.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Color Palette Ideas",
  description:
    "A curated, searchable gallery of ready-made color palettes — vintage, corporate, neon, pastel and more. Copy any palette in one click.",
};

export default function PaletteIdeasLayout({ children }: { children: React.ReactNode }) {
  return children;
}
