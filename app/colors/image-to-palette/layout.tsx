// -----------------------------------------------------------------------------
// @file: app/colors/image-to-palette/layout.tsx
// @purpose: Metadata and structured data for Image to palette.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

import { JsonLd } from "@/components/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, webApplicationJsonLd } from "@/lib/seo/structured-data";

const TOOL = {
  name: "Image to Palette",
  path: "/colors/image-to-palette",
  description:
    "Pull a color palette from your logo, photo or moodboard. Images are processed in your browser and never uploaded.",
};

export const metadata: Metadata = pageMetadata({
  title: "Image to Color Palette",
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

export default function ImageToPaletteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={structuredData} />
      {children}
    </>
  );
}
