// -----------------------------------------------------------------------------
// @file: app/colors/color-meanings/layout.tsx
// @purpose: Metadata and structured data for the Color Meanings encyclopedia.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Color Meanings",
  description:
    "An encyclopedia of color psychology and symbolism — what each color means, its cultural associations, and sample palettes that use it well.",
  path: "/colors/color-meanings",
});

// No JSON-LD here: this layout also wraps every /colors/color-meanings/[slug]
// page, so the hub's breadcrumb lives in page.tsx.
export default function ColorMeaningsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
