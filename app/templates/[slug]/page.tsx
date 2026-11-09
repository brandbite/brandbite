// -----------------------------------------------------------------------------
// @file: app/templates/[slug]/page.tsx
// @purpose: One free template: preview, what's inside, how to use it, and the
//           download, plus the guide and tool it pairs with.
// -----------------------------------------------------------------------------

import { statSync } from "node:fs";
import { join } from "node:path";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowRightIcon, DownloadIcon } from "@/components/colors/studio/icons";
import { studioButtonClasses } from "@/components/colors/studio/studio-button";
import { StudioShell } from "@/components/colors/studio/studio-shell";
import { JsonLd } from "@/components/seo/json-ld";
import { TemplatePreview } from "@/components/templates/template-preview";
import { pageMetadata } from "@/lib/seo/metadata";
import { absoluteUrl, breadcrumbJsonLd } from "@/lib/seo/structured-data";
import { getTemplate, TEMPLATES } from "@/lib/templates";

type PageProps = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return TEMPLATES.map((template) => ({ slug: template.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const template = getTemplate((await params).slug);
  if (!template) return { title: "Template", robots: { index: false, follow: false } };
  return pageMetadata({
    title: template.seoTitle,
    description: template.description,
    path: `/templates/${template.slug}`,
    image: `/templates/${template.slug}/opengraph-image`,
  });
}

/** File size for the download button, read at build time. */
function fileSize(publicPath: string): string {
  try {
    const bytes = statSync(join(process.cwd(), "public", publicPath)).size;
    return bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  } catch {
    return "";
  }
}

export default async function TemplatePage({ params }: PageProps) {
  const template = getTemplate((await params).slug);
  if (!template) notFound();

  const path = `/templates/${template.slug}`;
  const size = fileSize(template.file);
  const fileName = template.file.split("/").pop();
  const others = TEMPLATES.filter((other) => other.slug !== template.slug);

  return (
    <StudioShell
      label="TEMPLATES"
      nav={null}
      title={template.title}
      blurb={template.description}
      breadcrumb="Templates"
      ctaHeading="Template filled in?"
      ctaHeadingAccent="Let us design it."
      ctaBlurb="Send it to brandbite and get the finished design back, on one simple subscription."
    >
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "DigitalDocument",
            name: template.title,
            description: template.description,
            url: absoluteUrl(path),
            encodingFormat: template.extension,
            isAccessibleForFree: true,
            contentUrl: absoluteUrl(template.file),
          },
          breadcrumbJsonLd([
            { name: "Templates", path: "/templates" },
            { name: template.title, path },
          ]),
        ]}
      />

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-8 max-[1023px]:grid-cols-1">
        <TemplatePreview template={template} priority />

        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6">
            <a href={template.file} download={fileName} className={studioButtonClasses("primary")}>
              <DownloadIcon />
              Download for {template.format}
              {size ? <span className="font-normal opacity-90">· {size}</span> : null}
            </a>
            <p className="mt-3 text-sm leading-5 text-[var(--cs-muted)]">
              Free, no sign-up. Opens in {template.opensIn.join(", ")}.
            </p>
          </div>

          <section aria-labelledby="inside-heading">
            <h2 id="inside-heading" className="text-xl leading-7 font-semibold">
              What&apos;s inside
            </h2>
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-base leading-6">
              {template.inside.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="how-heading">
            <h2 id="how-heading" className="text-xl leading-7 font-semibold">
              How to use it
            </h2>
            <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-base leading-6">
              {template.howTo.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>

          {template.guide || template.tool ? (
            <ul className="flex flex-col gap-2">
              {[template.guide, template.tool]
                .filter((link): link is { href: string; label: string } => !!link)
                .map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-flex items-center gap-1.5 font-semibold text-[var(--cs-brand-strong)] hover:underline"
                    >
                      {link.label}
                      <ArrowRightIcon />
                    </Link>
                  </li>
                ))}
            </ul>
          ) : null}
        </div>
      </div>

      <nav aria-labelledby="more-templates-heading">
        <h2 id="more-templates-heading" className="text-lg leading-7 font-semibold">
          More free templates
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {others.map((other) => (
            <li key={other.slug}>
              <Link
                href={`/templates/${other.slug}`}
                className="flex h-11 items-center rounded-full border border-[var(--cs-border)] bg-[var(--cs-surface)] px-4 text-sm font-medium hover:border-[var(--cs-text)]"
              >
                {other.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </StudioShell>
  );
}
