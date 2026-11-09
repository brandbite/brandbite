// -----------------------------------------------------------------------------
// @file: app/guides/[slug]/page.tsx
// @purpose: One public guide: the article with a table of contents, the tool
//           it pairs with, and related pages. Code text with the CMS layer
//           applied; admin saves refresh it at once, otherwise within 5 min.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ArrowRightIcon } from "@/components/colors/studio/icons";
import { studioButtonClasses } from "@/components/colors/studio/studio-button";
import { StudioShell } from "@/components/colors/studio/studio-shell";
import { ArticleBody, TableOfContents } from "@/components/guides/article-body";
import { JsonLd } from "@/components/seo/json-ld";
import { guideMeta, PUBLIC_GUIDES, readMinutes } from "@/lib/guides";
import { pageMetadata } from "@/lib/seo/metadata";
import { blogPostingJsonLd, breadcrumbJsonLd } from "@/lib/seo/structured-data";
import { getEffectiveGuide } from "@/lib/support/effective";

// Next.js needs a literal here: CMS edits show up within 5 minutes.
export const revalidate = 300;

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return PUBLIC_GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { guide } = await getEffectiveGuide("public", (await params).slug);
  if (!guide) return { title: "Guide not found", robots: { index: false, follow: false } };
  return pageMetadata({
    title: guide.title,
    description: guide.summary,
    path: `/guides/${guide.slug}`,
    type: "article",
    image: `/guides/${guide.slug}/opengraph-image`,
  });
}

const DATE = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

export default async function GuidePage({ params }: PageProps) {
  const { slug } = await params;
  const { guide, hidden, all } = await getEffectiveGuide("public", slug);
  if (hidden) redirect("/guides");
  if (!guide) notFound();

  const meta = guideMeta(guide.slug);
  const path = `/guides/${guide.slug}`;
  const others = all.filter((other) => other.slug !== guide.slug).slice(0, 3);

  return (
    <StudioShell
      label="GUIDES"
      nav={null}
      title={guide.title}
      blurb={guide.summary}
      breadcrumb="Guides"
      ctaHeading="Less reading."
      ctaHeadingAccent="More design."
      ctaBlurb="Hand your design work to brandbite: one simple subscription, pause anytime."
    >
      <JsonLd
        data={[
          blogPostingJsonLd({
            title: guide.title,
            path,
            description: guide.summary,
            imageUrl: `${path}/opengraph-image`,
            publishedAt: new Date(`${meta.updatedOn}T00:00:00Z`),
            updatedAt: new Date(`${meta.updatedOn}T00:00:00Z`),
          }),
          breadcrumbJsonLd([
            { name: "Guides", path: "/guides" },
            { name: guide.title, path },
          ]),
        ]}
      />

      <p className="-mt-4 text-sm leading-5 text-[var(--cs-muted)]">
        {readMinutes(guide)} min read · Updated {DATE(meta.updatedOn)}
      </p>

      <div className="grid grid-cols-[220px_minmax(0,1fr)] items-start gap-10 max-[1023px]:grid-cols-1">
        <aside className="sticky top-6 flex flex-col gap-6 max-[1023px]:static">
          <TableOfContents guide={guide} />
        </aside>

        <div className="flex max-w-[760px] flex-col gap-10">
          <article className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-10 max-[767px]:p-5">
            <ArticleBody guide={guide} />
          </article>

          <section
            aria-labelledby="tool-heading"
            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[var(--cs-soft)] p-6"
          >
            <div className="max-w-[480px]">
              <h2 id="tool-heading" className="text-lg leading-7 font-semibold">
                Free tool
              </h2>
              <p className="mt-1 text-base leading-6">{meta.tool.blurb}</p>
            </div>
            <Link href={meta.tool.href} className={studioButtonClasses("primary")}>
              {meta.tool.label}
              <ArrowRightIcon />
            </Link>
          </section>

          {meta.links.length > 0 ? (
            <nav aria-labelledby="links-heading">
              <h2 id="links-heading" className="text-lg leading-7 font-semibold">
                Useful tools
              </h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {meta.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="flex h-11 items-center rounded-full border border-[var(--cs-border)] bg-[var(--cs-surface)] px-4 text-sm font-medium hover:border-[var(--cs-text)]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

          {others.length > 0 ? (
            <nav aria-labelledby="more-guides-heading">
              <h2 id="more-guides-heading" className="text-lg leading-7 font-semibold">
                More guides
              </h2>
              <ul className="mt-3 grid grid-cols-3 gap-4 max-[767px]:grid-cols-1">
                {others.map((other) => (
                  <li key={other.slug}>
                    <Link
                      href={`/guides/${other.slug}`}
                      className="flex h-full flex-col gap-1 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-4 hover:border-[var(--cs-text)]"
                    >
                      <span className="text-sm text-[var(--cs-muted)]">{other.category}</span>
                      <span className="font-semibold">{other.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>
      </div>
    </StudioShell>
  );
}
