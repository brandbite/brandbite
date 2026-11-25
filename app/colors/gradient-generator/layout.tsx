// -----------------------------------------------------------------------------
// @file: app/colors/gradient-generator/layout.tsx
// @purpose: Metadata and structured data for the Gradient generator.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

import { JsonLd } from "@/components/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, webApplicationJsonLd } from "@/lib/seo/structured-data";

const TOOL = {
  name: "Gradient Generator",
  path: "/colors/gradient-generator",
  description:
    "Build a linear or radial gradient from up to six colors, set the angle, then copy the CSS or download it as a PNG for social posts, slides and backgrounds.",
};

export const metadata: Metadata = pageMetadata({
  title: "CSS Gradient Generator with PNG Download",
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

export default function GradientGeneratorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={structuredData} />
      {children}
    </>
  );
}
