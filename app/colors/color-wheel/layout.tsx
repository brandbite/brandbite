// -----------------------------------------------------------------------------
// @file: app/colors/color-wheel/layout.tsx
// @purpose: Metadata and structured data for the Color Wheel tool.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

import { JsonLd } from "@/components/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, webApplicationJsonLd } from "@/lib/seo/structured-data";

const TOOL = {
  name: "Color Wheel",
  path: "/colors/color-wheel",
  description:
    "Interactive color wheel — pick a color and instantly see complementary, analogous, triadic, tetradic, and monochromatic harmonies. Copy HEX, RGB, and HSL.",
};

export const metadata: Metadata = pageMetadata({
  title: "Color Wheel and Color Harmonies",
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

export default function ColorWheelLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={structuredData} />
      {children}
    </>
  );
}
