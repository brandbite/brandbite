// -----------------------------------------------------------------------------
// @file: components/marketing/cms-page-view.tsx
// @purpose: Shared view for CMS-managed single pages (About, Contact, Documentation)
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

type CmsPageData = {
  pageKey: string;
  title: string;
  subtitle: string | null;
  heroUrl: string | null;
  body: string | null;
};

type CmsPageViewProps = {
  pageKey: string;
};

export function CmsPageView({ pageKey }: CmsPageViewProps) {
  const [page, setPage] = useState<CmsPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/pages/${pageKey}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => setPage(data.page))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [pageKey]);

  return (
    <div className="flex min-h-screen flex-col bg-white text-[var(--bb-secondary)]">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden bg-white px-6 pt-14 pb-16 sm:pt-20 sm:pb-20">
        <img
          src="/bitemark.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 h-full w-auto max-w-none object-cover object-left-top select-none"
        />

        <div className="relative mx-auto max-w-6xl text-center">
          {loading ? (
            <div className="mx-auto h-12 w-48 animate-pulse rounded bg-gray-200" />
          ) : notFound ? (
            <h1 className="font-brand text-4xl font-bold tracking-tight sm:text-5xl">
              Page Not Found
            </h1>
          ) : (
            <>
              <p className="text-sm font-bold tracking-widest text-[var(--bb-primary)] uppercase">
                {page!.pageKey}
              </p>
              <h1 className="font-brand mt-3 text-4xl font-bold tracking-tight text-[var(--bb-secondary)] sm:text-5xl">
                {page!.title}
              </h1>
              {page!.subtitle && (
                <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[var(--bb-text-secondary)]">
                  {page!.subtitle}
                </p>
              )}
            </>
          )}
        </div>
      </section>

      {/* Hero image */}
      {page?.heroUrl && (
        <section className="mx-auto w-full max-w-5xl px-6">
          <div className="overflow-hidden rounded-2xl">
            <img src={page.heroUrl} alt={page.title} className="h-auto w-full object-cover" />
          </div>
        </section>
      )}

      {/* Body */}
      <section className="mx-auto w-full max-w-3xl px-6 py-16">
        {loading ? (
          <div className="space-y-4">
            <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-gray-200" />
          </div>
        ) : notFound ? (
          <p className="text-center text-[var(--bb-text-secondary)]">
            This page hasn&apos;t been set up yet. Check back soon.
          </p>
        ) : page?.body ? (
          <div
            className="prose prose-gray prose-headings:font-brand prose-headings:tracking-tight prose-a:text-[var(--bb-primary)] prose-a:no-underline hover:prose-a:underline max-w-none"
            dangerouslySetInnerHTML={{ __html: page.body }}
          />
        ) : (
          <p className="text-center text-[var(--bb-text-secondary)]">Content coming soon.</p>
        )}
      </section>

      <SiteFooter />
    </div>
  );
}
