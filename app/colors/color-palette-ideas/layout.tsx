// -----------------------------------------------------------------------------
// @file: app/colors/color-palette-ideas/layout.tsx
// @purpose: Metadata and structured data for the Palette Ideas gallery.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

import { JsonLd } from "@/components/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd } from "@/lib/seo/structured-data";

const TOOL = {
  name: "Color Palette Ideas",
  path: "/colors/color-palette-ideas",
  description:
    "A curated, searchable gallery of ready-made color palettes — vintage, corporate, neon, pastel and more. Copy any palette in one click.",
};

export const metadata: Metadata = pageMetadata({
  title: "Color Palette Ideas",
  description: TOOL.description,
  path: TOOL.path,
});

const structuredData = [
  breadcrumbJsonLd([
    { name: "Color Studio", path: "/colors" },
    { name: TOOL.name, path: TOOL.path },
  ]),
];

export default function PaletteIdeasLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={structuredData} />
      {children}
    </>
  );
}
