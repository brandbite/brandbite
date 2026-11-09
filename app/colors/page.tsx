// -----------------------------------------------------------------------------
// @file: app/colors/page.tsx
// @purpose: Color Studio overview: start from a brand color, or open a tool.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Image from "next/image";

import { OverviewView } from "@/components/colors/studio/overview-view";
import { StudioShell } from "@/components/colors/studio/studio-shell";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Free Color Tools for Brands",
  description: "Tools and palettes that keep your brand bold, consistent, and unmistakably yours.",
  path: "/colors",
});

export default function ColorsHubPage() {
  return (
    <StudioShell
      title="Colors that hit"
      accent="different."
      blurb="Find your palette. Build your shades. Make it yours."
      aside={
        <Image
          src="/home/colors-bb.webp"
          alt="BB the unicorn holding color swatch fans"
          width={280}
          height={280}
          priority
          className="h-[280px] w-[280px] object-contain"
        />
      }
    >
      <OverviewView />
    </StudioShell>
  );
}
