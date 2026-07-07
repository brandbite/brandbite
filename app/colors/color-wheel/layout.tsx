// -----------------------------------------------------------------------------
// @file: app/colors/color-wheel/layout.tsx
// @purpose: Metadata-only server wrapper for the Color Wheel tool.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Color Wheel",
  description:
    "Interactive color wheel — pick a color and instantly see complementary, analogous, triadic, tetradic, and monochromatic harmonies. Copy HEX, RGB, and HSL.",
};

export default function ColorWheelLayout({ children }: { children: React.ReactNode }) {
  return children;
}
