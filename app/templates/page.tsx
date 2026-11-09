// -----------------------------------------------------------------------------
// @file: app/templates/page.tsx
// @purpose: Free templates hub.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Link from "next/link";

import { ArrowRightIcon } from "@/components/colors/studio/icons";
import { StudioShell } from "@/components/colors/studio/studio-shell";
import { JsonLd } from "@/components/seo/json-ld";
import { TemplatePreview } from "@/components/templates/template-preview";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd } from "@/lib/seo/structured-data";
import { TEMPLATES } from "@/lib/templates";

export const metadata: Metadata = pageMetadata({
  title: "Free Design and Marketing Templates",
  description:
    "Free templates for growing teams: a creative brief, a social media content calendar and a brand guidelines deck, for Word, Excel and PowerPoint.",
  path: "/templates",
  image: "/templates/opengraph-image",
});

export default function TemplatesPage() {
  return (
    <StudioShell
      label="TEMPLATES"
      nav={null}
      title="Free templates for"
      accent="better briefs."
      blurb="Download, fill in, share. Works in Word, Excel and PowerPoint, and in Google Docs, Sheets and Slides."
      ctaHeading="Template filled in?"
      ctaHeadingAccent="Let us design it."
      ctaBlurb="Send it to brandbite and get the finished design back, on one simple subscription."
    >
      <JsonLd data={breadcrumbJsonLd([{ name: "Templates", path: "/templates" }])} />
      <ul className="grid grid-cols-3 gap-6 max-[1023px]:grid-cols-2 max-[639px]:grid-cols-1">
        {TEMPLATES.map((template) => (
          <li key={template.slug}>
            <Link
              href={`/templates/${template.slug}`}
              className="flex h-full flex-col gap-4 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-5 hover:border-[var(--cs-text)]"
            >
              <div className="max-h-[280px] overflow-hidden rounded-xl">
                <TemplatePreview template={template} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-[var(--cs-muted)]">
                  {template.format}
                </span>
                <span className="text-lg leading-7 font-semibold">{template.title}</span>
                <span className="text-sm leading-5 text-[var(--cs-muted)]">
                  {template.description}
                </span>
              </div>
              <span className="mt-auto flex items-center gap-1 text-sm font-semibold text-[var(--cs-brand-strong)]">
                Get the template
                <ArrowRightIcon />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </StudioShell>
  );
}
