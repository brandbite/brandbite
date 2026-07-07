// -----------------------------------------------------------------------------
// @file: app/colors/color-palette-generator/layout.tsx
// @purpose: Metadata-only server wrapper for the Palette Generator tool.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Color Palette Generator",
  description:
    "Generate harmonious color palettes at random, lock colors and reroll the rest, or upload an image to extract its dominant colors — all in your browser. Copy and save.",
};

export default function PaletteGeneratorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
