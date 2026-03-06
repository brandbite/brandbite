// -----------------------------------------------------------------------------
// @file: app/documentation/[categorySlug]/page.tsx
// @purpose: Documentation category page — lists articles within a category
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

type DocArticleSummary = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: string | null;
};

type DocCategory = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  icon: string | null;
  audience: string;
  articles: DocArticleSummary[];
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DocCategoryPage() {
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const [category, setCategory] = useState<DocCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!categorySlug) return;

    fetch(`/api/docs/categories/${categorySlug}`)
      .then((res) => {
        if (!res.ok) {
          setNotFound(true);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.category) {
          setCategory(data.category);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [categorySlug]);

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
            Category not found
          </h1>
          <p className="mt-3 text-[var(--bb-text-secondary)]">
            The documentation category you&apos;re looking for doesn&apos;t exist.
          </p>
          <Link
            href="/documentation"
            className="mt-6 inline-block text-sm font-medium text-[var(--bb-primary)] transition-colors hover:underline"
          >
            &larr; Back to Documentation
          </Link>
        </div>
      )}

      {/* Category content */}
      {!loading && category && (
        <>
          {/* Hero */}
          <section className="relative overflow-hidden bg-white px-6 pt-14 pb-10 sm:pt-20 sm:pb-14">
            <img
              src="/bitemark.svg"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute top-0 left-0 h-full w-auto max-w-none object-cover object-left-top select-none"
            />
            <div className="relative mx-auto max-w-6xl">
              {/* Breadcrumbs */}
              <nav className="mb-6 flex items-center gap-2 text-sm text-[var(--bb-text-tertiary)]">
                <Link
                  href="/documentation"
                  className="text-[var(--bb-primary)] transition-colors hover:underline"
                >
                  Documentation
                </Link>
                <span>/</span>
                <span className="text-[var(--bb-secondary)]">{category.title}</span>
              </nav>

              <div className="flex items-center gap-3">
                {category.icon && <span className="text-4xl">{category.icon}</span>}
                <h1 className="font-brand text-3xl font-bold tracking-tight text-[var(--bb-secondary)] sm:text-4xl">
                  {category.title}
                </h1>
              </div>
              {category.description && (
                <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--bb-text-secondary)]">
                  {category.description}
                </p>
              )}
            </div>
          </section>

          {/* Articles list */}
          <section className="mx-auto max-w-6xl px-6 py-12">
            {category.articles.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-lg text-[var(--bb-text-secondary)]">
                  No articles published in this category yet.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--bb-border-subtle)]">
                {category.articles.map((article) => (
                  <Link
                    key={article.id}
                    href={`/documentation/${category.slug}/${article.slug}`}
                    className="group flex flex-col gap-1 py-5 transition-colors first:pt-0"
                  >
                    <h3 className="text-base font-semibold text-[var(--bb-secondary)] group-hover:text-[var(--bb-primary)]">
                      {article.title}
                    </h3>
                    {article.excerpt && (
                      <p className="line-clamp-2 text-sm leading-relaxed text-[var(--bb-text-secondary)]">
                        {article.excerpt}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <SiteFooter />
    </div>
  );
}
