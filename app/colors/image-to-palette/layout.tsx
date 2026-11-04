// -----------------------------------------------------------------------------
// @file: app/colors/image-to-palette/layout.tsx
// @purpose: Metadata-only server wrapper for Image to palette.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Image to Palette",
  description:
    "Pull a color palette from your logo, photo or moodboard. Images are processed in your browser and never uploaded.",
};

export default function ImageToPaletteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
