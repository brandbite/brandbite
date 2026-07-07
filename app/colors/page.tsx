// -----------------------------------------------------------------------------
// @file: app/colors/page.tsx
// @purpose: Public hub for the color tools. Links to the two Phase-1 tools and
//           reserves slots for the Phase-2 gallery + encyclopedia.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Card, CardBody } from "@/components/ui/card";

type Tool = {
  href: string;
  title: string;
  description: string;
  swatches: string[];
  available: boolean;
};

const TOOLS: Tool[] = [
  {
    href: "/colors/color-wheel",
    title: "Color Wheel",
    description:
      "Drag around an interactive wheel and see complementary, analogous, triadic, tetradic, and monochromatic harmonies update live. Copy HEX, RGB, or HSL.",
    swatches: ["#f15b2b", "#2bb0f1", "#2bf177", "#a12bf1"],
    available: true,
  },
  {
    href: "/colors/color-palette-generator",
    title: "Palette Generator",
    description:
      "Generate harmonious palettes at random, lock the colors you love and reroll the rest, or upload an image to extract its dominant colors — all in your browser.",
    swatches: ["#424143", "#f15b2b", "#fff0ea", "#7a7a7a"],
    available: true,
  },
  {
    href: "/colors/color-palette-ideas",
    title: "Palette Ideas",
    description:
      "A curated, searchable gallery of ready-made palettes — filter by vibe (vintage, corporate, neon, pastel) and copy any color in a click.",
    swatches: ["#e8d5c4", "#b5651d", "#f4a460", "#8b4513"],
    available: true,
  },
  {
    href: "/colors/color-meanings",
    title: "Color Meanings",
    description:
      "An encyclopedia of color psychology and cultural symbolism, with HEX/RGB/HSL values and sample palettes for every color.",
    swatches: ["#c0392b", "#2980b9", "#27ae60", "#f1c40f"],
    available: true,
  },
];

export default function ColorsHubPage() {
  return (
    <div className="min-h-screen bg-[var(--bb-bg-page)] text-[var(--bb-secondary)]">
      <SiteHeader activePage="Color Tools" />
      <main className="mx-auto max-w-6xl px-4 py-12 md:px-6">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-brand text-3xl font-bold text-[var(--bb-secondary)] md:text-4xl">
              Color Tools
            </h1>
            <p className="mt-2 max-w-2xl text-[var(--bb-text-secondary)]">
              A small suite of color utilities for building brand palettes. Free to use — save your
              favorites when you’re signed in.
            </p>
          </div>
          <ThemeToggle />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {TOOLS.map((tool) => {
            const inner = (
              <Card interactive={tool.available} className="h-full">
                <div className="flex h-20 overflow-hidden rounded-t-2xl">
                  {tool.swatches.map((hex) => (
                    <div key={hex} className="flex-1" style={{ backgroundColor: hex }} />
                  ))}
                </div>
                <CardBody>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-[var(--bb-secondary)]">
                      {tool.title}
                    </h2>
                    {!tool.available ? (
                      <span className="rounded-full bg-[var(--bb-bg-warm)] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--bb-text-muted)] uppercase">
                        Soon
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-sm text-[var(--bb-text-tertiary)]">
                    {tool.description}
                  </p>
                </CardBody>
              </Card>
            );
            return tool.available ? (
              <Link key={tool.title} href={tool.href} className="block">
                {inner}
              </Link>
            ) : (
              <div key={tool.title} className="cursor-default opacity-70">
                {inner}
              </div>
            );
          })}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
