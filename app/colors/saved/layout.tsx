// -----------------------------------------------------------------------------
// @file: app/colors/saved/layout.tsx
// @purpose: Metadata for the personal saved-palettes page. Not indexed, because
//           its content differs for every visitor.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Saved palettes",
  description: "Everything you save across Color Studio, in one place.",
  robots: { index: false, follow: false },
};

export default function SavedPalettesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
