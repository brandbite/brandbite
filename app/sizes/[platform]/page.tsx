// -----------------------------------------------------------------------------
// @file: app/sizes/[platform]/page.tsx
// @purpose: Every image and video size for one platform, in the first HTML:
//           an at-a-glance table, a card per format, tips and sources.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StudioShell } from "@/components/colors/studio/studio-shell";
import { JsonLd } from "@/components/seo/json-ld";
import { FormatCard } from "@/components/sizes/format-card";
import {
  formatCheckedOn,
  SIZE_GUIDE_CTA,
  SIZE_GUIDE_LABEL,
  SizeNav,
  SizeTable,
} from "@/components/sizes/size-guide-parts";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd } from "@/lib/seo/structured-data";
import { getSizePlatform, SIZE_PLATFORMS } from "@/lib/sizes";

type PageProps = { params: Promise<{ platform: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return SIZE_PLATFORMS.map((platform) => ({ platform: platform.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const platform = getSizePlatform((await params).platform);
  if (!platform) return { title: "Size guide", robots: { index: false, follow: false } };
  return pageMetadata({
    title: platform.seoTitle,
    description: platform.description,
    path: `/sizes/${platform.slug}`,
    image: `/sizes/${platform.slug}/opengraph-image`,
  });
}

export default async function PlatformSizesPage({ params }: PageProps) {
  const platform = getSizePlatform((await params).platform);
  if (!platform) notFound();

  const path = `/sizes/${platform.slug}`;
  const others = SIZE_PLATFORMS.filter((other) => other.slug !== platform.slug);

  return (
    <StudioShell
      label={SIZE_GUIDE_LABEL}
      nav={<SizeNav />}
      title={platform.headline}
      accent="sizes."
      blurb={platform.description}
      breadcrumb={platform.name}
      {...SIZE_GUIDE_CTA}
    >
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Size guide", path: "/sizes" },
          { name: platform.name, path },
        ])}
      />

      <SizeTable
        caption={`${platform.name} sizes at a glance`}
        rows={platform.formats.map((format) => ({ format }))}
      />

      <section aria-labelledby="formats-heading" className="flex flex-col gap-4">
        <h2 id="formats-heading" className="text-2xl leading-8 font-semibold">
          Every {platform.name} format
        </h2>
        <p className="text-base leading-6 text-[var(--cs-muted)]">
          Shaded areas may be covered by the {platform.name} interface. Download a blank template
          with them marked.
        </p>
        <div className="grid grid-cols-3 gap-6 max-[1023px]:grid-cols-2 max-[639px]:grid-cols-1">
          {platform.formats.map((format) => (
            <FormatCard
              key={format.id}
              format={format}
              platformName={platform.name}
              platformSlug={platform.slug}
            />
          ))}
        </div>
      </section>

      <section
        aria-labelledby="tips-heading"
        className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-8 max-[767px]:p-5"
      >
        <h2 id="tips-heading" className="text-2xl leading-8 font-semibold">
          Tips for {platform.name}
        </h2>
        <ul className="mt-4 flex list-disc flex-col gap-2 pl-5 text-base leading-6">
          {platform.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="sources-heading" className="text-sm leading-5">
        <h2 id="sources-heading" className="font-semibold">
          Sources
        </h2>
        <p className="mt-1 text-[var(--cs-muted)]">
          Last checked against the official specs in {formatCheckedOn(platform.checkedOn)}.
          Platforms change sizes often; check the source before a big launch.
        </p>
        <ul className="mt-2 flex flex-col gap-1">
          {platform.sources.map((source) => (
            <li key={source.url}>
              <a
                href={source.url}
                className="text-[var(--cs-brand-strong)] hover:underline"
                rel="noopener noreferrer"
                target="_blank"
              >
                {source.label}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <nav aria-labelledby="more-heading">
        <h2 id="more-heading" className="text-lg leading-7 font-semibold">
          Sizes for other platforms
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {others.map((other) => (
            <li key={other.slug}>
              <Link
                href={`/sizes/${other.slug}`}
                className="flex h-11 items-center rounded-full border border-[var(--cs-border)] bg-[var(--cs-surface)] px-4 text-sm font-medium hover:border-[var(--cs-text)]"
              >
                {other.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </StudioShell>
  );
}
