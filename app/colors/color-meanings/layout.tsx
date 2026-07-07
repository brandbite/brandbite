// -----------------------------------------------------------------------------
// @file: app/colors/color-meanings/layout.tsx
// @purpose: Metadata-only server wrapper for the Color Meanings encyclopedia.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Color Meanings",
  description:
    "An encyclopedia of color psychology and symbolism — what each color means, its cultural associations, and sample palettes that use it well.",
};

export default function ColorMeaningsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
