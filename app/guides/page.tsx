// -----------------------------------------------------------------------------
// @file: app/guides/page.tsx
// @purpose: Public guides hub: practical guides on briefs, branding and hiring
//           design, grouped by topic, each linking to its free tool.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Link from "next/link";

import { ArrowRightIcon } from "@/components/colors/studio/icons";
import { StudioShell } from "@/components/colors/studio/studio-shell";
import { JsonLd } from "@/components/seo/json-ld";
import { readMinutes } from "@/lib/guides";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd } from "@/lib/seo/structured-data";
import { getEffectiveGuides } from "@/lib/support/effective";
import type { SupportGuide } from "@/lib/support/types";

// Next.js needs a literal here: CMS edits show up within 5 minutes.
export const revalidate = 300;

export const metadata: Metadata = pageMetadata({
  title: "Design and Branding Guides",
  description:
    "Practical guides for growing teams: writing a creative brief, choosing brand colors and fonts, and deciding who should do your design work.",
  path: "/guides",
  image: "/guides/opengraph-image",
});

function groupByCategory(guides: SupportGuide[]) {
  const groups = new Map<string, SupportGuide[]>();
  for (const guide of guides)
    groups.set(guide.category, [...(groups.get(guide.category) ?? []), guide]);
  return [...groups.entries()];
}

export default async function GuidesPage() {
  const { guides } = await getEffectiveGuides("public");

  return (
    <StudioShell
      label="GUIDES"
      nav={null}
      title="Guides for better"
      accent="design work."
      blurb="Short, practical guides for teams that need design without the guesswork."
      ctaHeading="Less reading."
      ctaHeadingAccent="More design."
      ctaBlurb="Hand your design work to brandbite: one simple subscription, pause anytime."
    >
      <JsonLd data={breadcrumbJsonLd([{ name: "Guides", path: "/guides" }])} />
      {groupByCategory(guides).map(([category, items]) => (
        <section key={category} aria-label={category} className="flex flex-col gap-4">
          <h2 className="text-2xl leading-8 font-semibold">{category}</h2>
          <ul className="grid grid-cols-2 gap-6 max-[767px]:grid-cols-1">
            {items.map((guide) => (
              <li key={guide.slug}>
                <Link
                  href={`/guides/${guide.slug}`}
                  className="flex h-full flex-col gap-3 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 hover:border-[var(--cs-text)]"
                >
                  <span className="text-xl leading-7 font-semibold">{guide.title}</span>
                  <span className="text-base leading-6 text-[var(--cs-muted)]">
                    {guide.summary}
                  </span>
                  <span className="mt-auto flex items-center justify-between pt-2 text-sm">
                    <span className="text-[var(--cs-muted)]">{readMinutes(guide)} min read</span>
                    <span className="flex items-center gap-1 font-semibold text-[var(--cs-brand-strong)]">
                      Read
                      <ArrowRightIcon />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </StudioShell>
  );
}
