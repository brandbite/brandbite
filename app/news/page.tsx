// -----------------------------------------------------------------------------
// @file: app/news/page.tsx
// @purpose: News listing page — displays all published news articles
// -----------------------------------------------------------------------------

"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NewsArticle = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  authorName: string | null;
  category: string | null;
  tags: string[];
  thumbnailUrl: string | null;
  publishedAt: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NewsListingPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/news")
      .then((res) => res.json())
      .then((data) => setArticles(data.articles ?? []))
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-white text-[var(--bb-secondary)]">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden bg-white px-6 pt-14 pb-16 sm:pt-20 sm:pb-20">
        <img
          src="/bitemark.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 h-full w-auto max-w-none object-cover object-left-top select-none"
        />
        <div className="relative mx-auto max-w-6xl">
          <p className="text-sm font-bold tracking-widest text-[var(--bb-primary)] uppercase">
            News
          </p>
          <h1 className="font-brand mt-3 text-4xl font-bold tracking-tight text-[var(--bb-secondary)] sm:text-5xl">
            Latest updates
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--bb-text-secondary)]">
            Company announcements, product updates, and industry news.
          </p>
        </div>
      </section>

      {/* Article grid */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--bb-border)] border-t-[var(--bb-primary)]" />
          </div>
        ) : articles.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-lg text-[var(--bb-text-secondary)]">
              No news articles yet. Check back soon!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <Link
                key={article.id}
                href={`/news/${article.slug}`}
                className="group overflow-hidden rounded-xl border border-[var(--bb-border-subtle)] bg-white transition-shadow hover:shadow-lg"
              >
                {/* Thumbnail */}
                <div className="relative aspect-[16/9] bg-[#e8dff5]">
                  {article.thumbnailUrl ? (
                    <Image
                      src={article.thumbnailUrl}
                      alt={article.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-gray-400">
                      No image
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-5">
                  {article.category && (
                    <span className="mb-2 inline-block rounded-full bg-[var(--bb-primary-light)] px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--bb-primary)] uppercase">
                      {article.category}
                    </span>
                  )}
                  <h3 className="text-lg font-bold text-[var(--bb-secondary)] group-hover:text-[var(--bb-primary)]">
                    {article.title}
                  </h3>
                  {article.excerpt && (
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--bb-text-secondary)]">
                      {article.excerpt}
                    </p>
                  )}
                  <div className="mt-4 flex items-center gap-2 text-xs text-[var(--bb-text-tertiary)]">
                    {article.authorName && (
                      <>
                        <span className="font-medium">{article.authorName}</span>
                        <span>&middot;</span>
                      </>
                    )}
                    <span>{formatDate(article.publishedAt)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <SiteFooter />
    </div>
  );
}
