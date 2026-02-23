// -----------------------------------------------------------------------------
// @file: app/news/[slug]/page.tsx
// @purpose: News detail page — renders a single published news article
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
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
  body: string;
  excerpt: string | null;
  authorName: string | null;
  category: string | null;
  tags: string[];
  thumbnailUrl: string | null;
  heroUrl: string | null;
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

export default function NewsArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;

    fetch(`/api/news/${slug}`)
      .then((res) => {
        if (!res.ok) {
          setNotFound(true);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.article) {
          setArticle(data.article);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <div className="min-h-screen bg-white text-[var(--bb-secondary)]">
      <SiteHeader />

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--bb-border)] border-t-[var(--bb-primary)]" />
        </div>
      )}

      {/* Not found */}
      {!loading && notFound && (
        <div className="mx-auto max-w-3xl px-6 py-32 text-center">
          <h1 className="font-brand text-3xl font-bold text-[var(--bb-secondary)]">
            Article not found
          </h1>
          <p className="mt-3 text-[var(--bb-text-secondary)]">
            The news article you&apos;re looking for doesn&apos;t exist or has been removed.
          </p>
          <Link
            href="/news"
            className="mt-6 inline-block text-sm font-medium text-[var(--bb-primary)] transition-colors hover:underline"
          >
            &larr; Back to News
          </Link>
        </div>
      )}

      {/* Article content */}
      {!loading && article && (
        <>
          {article.heroUrl && (
            <div className="mx-auto max-h-[500px] overflow-hidden">
              <img
                src={article.heroUrl}
                alt={article.title}
                className="h-full w-full object-cover"
              />
            </div>
          )}

          <div className="mx-auto max-w-3xl px-6 py-12">
            <Link
              href="/news"
              className="inline-flex items-center gap-1 text-sm font-medium text-[var(--bb-primary)] transition-colors hover:underline"
            >
              &larr; Back to News
            </Link>

            <h1 className="font-brand mt-8 text-3xl font-bold text-[var(--bb-secondary)] sm:text-4xl lg:text-5xl">
              {article.title}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[var(--bb-text-secondary)]">
              {article.category && (
                <span className="rounded-full bg-[var(--bb-primary-light)] px-2.5 py-0.5 text-xs font-medium text-[var(--bb-primary)]">
                  {article.category}
                </span>
              )}
              {article.authorName && (
                <>
                  <span className="font-medium">{article.authorName}</span>
                  <span>&middot;</span>
                </>
              )}
              <span>{formatDate(article.publishedAt)}</span>
            </div>

            <div className="my-8 border-t border-[var(--bb-border-subtle)]" />

            <article
              className="prose prose-lg prose-headings:font-brand prose-headings:text-[var(--bb-secondary)] prose-p:text-[var(--bb-text-secondary)] prose-p:leading-relaxed prose-a:text-[var(--bb-primary)] prose-a:no-underline hover:prose-a:underline prose-strong:text-[var(--bb-secondary)] prose-li:text-[var(--bb-text-secondary)] max-w-none"
              dangerouslySetInnerHTML={{ __html: article.body }}
            />
          </div>

          <section className="bg-[var(--bb-bg-page)] py-20 sm:py-24">
            <div className="mx-auto max-w-3xl px-6 text-center">
              <h2 className="font-brand text-2xl font-bold text-[var(--bb-secondary)] sm:text-3xl">
                Stay up to date
              </h2>
              <p className="mt-3 text-[var(--bb-text-secondary)]">
                Read more news and updates from the Brandbite team.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  href="/news"
                  className="rounded-full border border-[var(--bb-secondary)] px-6 py-2.5 text-sm font-semibold text-[var(--bb-secondary)] transition-colors hover:bg-[var(--bb-secondary)] hover:text-white"
                >
                  More news
                </Link>
                <Link
                  href="/blog"
                  className="rounded-full bg-[var(--bb-primary)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--bb-primary-hover)]"
                >
                  Read blog
                </Link>
              </div>
            </div>
          </section>
        </>
      )}

      <SiteFooter />
    </div>
  );
}
