// -----------------------------------------------------------------------------
// @file: app/colors/color-palette-generator/layout.tsx
// @purpose: Metadata and structured data for the Palette Generator tool.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

import { JsonLd } from "@/components/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, webApplicationJsonLd } from "@/lib/seo/structured-data";

const TOOL = {
  name: "Color Palette Generator",
  path: "/colors/color-palette-generator",
  description:
    "Generate harmonious color palettes at random, lock colors and reroll the rest, or upload an image to extract its dominant colors — all in your browser. Copy and save.",
};

export const metadata: Metadata = pageMetadata({
  title: "Color Palette Generator",
  description: TOOL.description,
  path: TOOL.path,
});

const structuredData = [
  webApplicationJsonLd(TOOL),
  breadcrumbJsonLd([
    { name: "Color Studio", path: "/colors" },
    { name: TOOL.name, path: TOOL.path },
  ]),
];

export default function PaletteGeneratorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={structuredData} />
      {children}
    </>
  );
}
