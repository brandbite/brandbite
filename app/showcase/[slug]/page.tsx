// -----------------------------------------------------------------------------
// @file: app/showcase/[slug]/page.tsx
// @purpose: Showcase detail page — single portfolio work with gallery
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { CMS_ALLOWED_ATTR, CMS_ALLOWED_TAGS, SafeHtml } from "@/components/ui/safe-html";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GalleryImage = {
  storageKey: string;
  url: string;
  alt?: string;
};

type ShowcaseWork = {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  clientName: string | null;
  category: string | null;
  tags: string[];
  thumbnailUrl: string | null;
  heroUrl: string | null;
  galleryImages: GalleryImage[] | null;
  description: string | null;
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ShowcaseDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [work, setWork] = useState<ShowcaseWork | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;

    async function fetchWork() {
      try {
        const res = await fetch(`/api/showcase/${slug}`);
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setWork(data.work ?? null);
      } catch (err) {
        console.error("[showcase/detail] fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchWork();
  }, [slug]);

  // Parse galleryImages — API may return a JSON string or already-parsed array
  const gallery: GalleryImage[] = (() => {
    if (!work?.galleryImages) return [];
    if (Array.isArray(work.galleryImages)) return work.galleryImages;
    try {
      const parsed = JSON.parse(work.galleryImages as unknown as string);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader activePage="Showcase" />

      {/* Loading */}
      {loading && (
        <div className="flex flex-1 items-center justify-center py-32 text-[var(--bb-text-secondary)]">
          Loading&hellip;
        </div>
      )}

      {/* Not found */}
      {!loading && (notFound || !work) && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-32">
          <p className="text-lg text-[var(--bb-text-secondary)]">Work not found.</p>
          <Link
            href="/showcase"
            className="text-sm font-medium text-[var(--bb-primary)] hover:underline"
          >
            &larr; Back to Showcase
          </Link>
        </div>
      )}

      {/* Detail content */}
      {!loading && work && (
        <>
          {/* --------------------------------------------------------------- */}
          {/* Hero image                                                      */}
          {/* --------------------------------------------------------------- */}
          {work.heroUrl ? (
            <div className="w-full">
              <img src={work.heroUrl} alt={work.title} className="h-[400px] w-full object-cover" />
            </div>
          ) : (
            <div className="h-[400px] w-full bg-[#e8dff5]" />
          )}

          {/* --------------------------------------------------------------- */}
          {/* Content                                                         */}
          {/* --------------------------------------------------------------- */}
          <section className="mx-auto w-full max-w-5xl px-6 py-12">
            {/* Back link */}
            <Link
              href="/showcase"
              className="inline-flex items-center gap-1 text-sm text-[var(--bb-primary)] hover:underline"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m12 19-7-7 7-7" />
                <path d="M19 12H5" />
              </svg>
              Back to Showcase
            </Link>

            {/* Title */}
            <h1 className="font-brand mt-6 text-3xl font-bold text-[var(--bb-secondary)] sm:text-4xl">
              {work.title}
            </h1>

            {/* Subtitle */}
            {work.subtitle && (
              <p className="mt-3 text-lg text-[var(--bb-text-secondary)]">{work.subtitle}</p>
            )}

            {/* Info bar */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {work.clientName && (
                <span className="text-sm font-medium text-[var(--bb-secondary)]">
                  {work.clientName}
                </span>
              )}
              {work.clientName && work.category && (
                <span className="text-[var(--bb-text-secondary)]">&middot;</span>
              )}
              {work.category && (
                <span className="rounded-full bg-[#eae6f1] px-3 py-1 text-xs text-[var(--bb-text-secondary)]">
                  {work.category}
                </span>
              )}
              {work.tags.length > 0 &&
                work.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-[var(--bb-bg-warm)] px-3 py-1 text-xs text-[var(--bb-text-secondary)]"
                  >
                    {tag}
                  </span>
                ))}
            </div>

            {/* Description */}
            {work.description && (
              <SafeHtml
                html={work.description}
                allowedTags={CMS_ALLOWED_TAGS}
                allowedAttrs={CMS_ALLOWED_ATTR}
                className="prose prose-headings:font-brand prose-headings:text-[var(--bb-secondary)] prose-li:marker:text-[var(--bb-primary)] mt-10 max-w-none"
              />
            )}
          </section>

          {/* --------------------------------------------------------------- */}
          {/* Gallery                                                         */}
          {/* --------------------------------------------------------------- */}
          {gallery.length > 0 && (
            <section className="mx-auto w-full max-w-5xl px-6 pb-16">
              <h2 className="mb-6 text-2xl font-bold text-[var(--bb-secondary)]">
                Project Gallery
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {gallery.map((img, idx) => (
                  <div
                    key={img.storageKey || idx}
                    className="aspect-[4/3] overflow-hidden rounded-lg"
                  >
                    <img
                      src={img.url}
                      alt={img.alt || `${work.title} gallery image ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* --------------------------------------------------------------- */}
          {/* CTA                                                             */}
          {/* --------------------------------------------------------------- */}
          <section className="bg-[var(--bb-secondary)] py-20 sm:py-24">
            <div className="mx-auto max-w-3xl px-6 text-center">
              <h2 className="font-brand text-3xl font-bold text-white sm:text-4xl">
                Like what you see?
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-lg text-gray-300">
                Let&apos;s create something amazing for your brand.
              </p>
              <Link
                href="/pricing"
                className="mt-8 inline-block rounded-full bg-[var(--bb-primary)] px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#d94e23]"
              >
                Get Started
              </Link>
            </div>
          </section>
        </>
      )}

      <SiteFooter />
    </div>
  );
}
