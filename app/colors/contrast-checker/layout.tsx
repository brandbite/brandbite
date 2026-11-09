// -----------------------------------------------------------------------------
// @file: app/colors/contrast-checker/layout.tsx
// @purpose: Metadata and structured data for the Contrast checker.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

import { JsonLd } from "@/components/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, webApplicationJsonLd } from "@/lib/seo/structured-data";

const TOOL = {
  name: "Contrast Checker",
  path: "/colors/contrast-checker",
  description:
    "Check the WCAG 2.2 AA and AAA text contrast of any color pair, preview it live, and get a readable alternative when it fails.",
};

export const metadata: Metadata = pageMetadata({
  title: "Color Contrast Checker (WCAG 2.2)",
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

export default function ContrastCheckerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={structuredData} />
      {children}
    </>
  );
}
