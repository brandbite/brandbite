// -----------------------------------------------------------------------------
// @file: app/colors/tailwind-color-generator/layout.tsx
// @purpose: Metadata and structured data for the Tailwind color generator.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

import { JsonLd } from "@/components/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, webApplicationJsonLd } from "@/lib/seo/structured-data";

const TOOL = {
  name: "Tailwind CSS Color Generator",
  path: "/colors/tailwind-color-generator",
  description:
    "Turn any color into a full Tailwind CSS shade scale (50–950). Copy the config or CSS variables in one click.",
};

export const metadata: Metadata = pageMetadata({
  title: "Tailwind CSS Color Generator",
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

export default function TailwindColorGeneratorLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={structuredData} />
      {children}
    </>
  );
}
