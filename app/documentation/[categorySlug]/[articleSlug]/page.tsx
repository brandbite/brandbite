// -----------------------------------------------------------------------------
// @file: app/documentation/[categorySlug]/[articleSlug]/page.tsx
// @purpose: Documentation article detail page — renders a single help article
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

type DocArticle = {
  id: string;
  title: string;
  slug: string;
  body: string;
  excerpt: string | null;
  authorName: string | null;
  publishedAt: string | null;
  category: {
    id: string;
    title: string;
    slug: string;
    audience: string;
  };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DocArticlePage() {
  const { categorySlug, articleSlug } = useParams<{
    categorySlug: string;
    articleSlug: string;
  }>();
  const [article, setArticle] = useState<DocArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!articleSlug) return;

    fetch(`/api/docs/articles/${articleSlug}`)
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
  }, [articleSlug]);

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
            The documentation article you&apos;re looking for doesn&apos;t exist or has been
            removed.
          </p>
          <Link
            href="/documentation"
            className="mt-6 inline-block text-sm font-medium text-[var(--bb-primary)] transition-colors hover:underline"
          >
            &larr; Back to Documentation
          </Link>
        </div>
      )}

      {/* Article content */}
      {!loading && article && (
        <>
          <div className="mx-auto max-w-3xl px-6 py-12">
            {/* Breadcrumbs */}
            <nav className="mb-8 flex items-center gap-2 text-sm text-[var(--bb-text-tertiary)]">
              <Link
                href="/documentation"
                className="text-[var(--bb-primary)] transition-colors hover:underline"
              >
                Documentation
              </Link>
              <span>/</span>
              <Link
                href={`/documentation/${article.category.slug}`}
                className="text-[var(--bb-primary)] transition-colors hover:underline"
              >
                {article.category.title}
              </Link>
              <span>/</span>
              <span className="truncate text-[var(--bb-secondary)]">{article.title}</span>
            </nav>

            <h1 className="font-brand text-3xl font-bold text-[var(--bb-secondary)] sm:text-4xl">
              {article.title}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[var(--bb-text-secondary)]">
              {article.authorName && (
                <>
                  <span className="font-medium">{article.authorName}</span>
                  <span>&middot;</span>
                </>
              )}
              {article.publishedAt && <span>{formatDate(article.publishedAt)}</span>}
            </div>

            <div className="my-8 border-t border-[var(--bb-border-subtle)]" />

            <article
              className="prose prose-lg prose-headings:font-brand prose-headings:text-[var(--bb-secondary)] prose-p:text-[var(--bb-text-secondary)] prose-p:leading-relaxed prose-a:text-[var(--bb-primary)] prose-a:no-underline hover:prose-a:underline prose-strong:text-[var(--bb-secondary)] prose-li:text-[var(--bb-text-secondary)] max-w-none"
              dangerouslySetInnerHTML={{ __html: article.body }}
            />
          </div>

          {/* CTA */}
          <section className="bg-[var(--bb-bg-page)] py-16 sm:py-20">
            <div className="mx-auto max-w-3xl px-6 text-center">
              <h2 className="font-brand text-2xl font-bold text-[var(--bb-secondary)]">
                Need more help?
              </h2>
              <p className="mt-3 text-[var(--bb-text-secondary)]">
                Browse more articles or get in touch with our support team.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  href={`/documentation/${categorySlug}`}
                  className="rounded-full border border-[var(--bb-secondary)] px-6 py-2.5 text-sm font-semibold text-[var(--bb-secondary)] transition-colors hover:bg-[var(--bb-secondary)] hover:text-white"
                >
                  More in {article.category.title}
                </Link>
                <Link
                  href="/documentation"
                  className="rounded-full bg-[var(--bb-primary)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--bb-primary-hover)]"
                >
                  All Documentation
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
