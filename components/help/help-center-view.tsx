// -----------------------------------------------------------------------------
// @file: components/help/help-center-view.tsx
// @purpose: Shared help center view for customers and designers
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-02-23
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState, useCallback } from "react";
import { FormInput } from "@/components/ui/form-field";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { SafeHtml } from "@/components/ui/safe-html";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

type HelpCategoryItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  articleCount: number;
};

type HelpArticleItem = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
};

type HelpArticleDetail = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  updatedAt: string;
};

type HelpView =
  | { type: "categories" }
  | { type: "category"; slug: string; name: string; icon: string | null }
  | { type: "article"; slug: string; catSlug: string; catName: string };

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export function HelpCenterView({ role }: { role: "customer" | "designer" }) {
  const [view, setView] = useState<HelpView>({ type: "categories" });

  // Categories
  const [categories, setCategories] = useState<HelpCategoryItem[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catError, setCatError] = useState<string | null>(null);

  // Articles list
  const [articles, setArticles] = useState<HelpArticleItem[]>([]);
  const [artLoading, setArtLoading] = useState(false);

  // Single article
  const [article, setArticle] = useState<HelpArticleDetail | null>(null);
  const [artDetailLoading, setArtDetailLoading] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<HelpArticleItem[]>([]);
  const [searching, setSearching] = useState(false);

  // ---------------------------------------------------------------------------
  // Load categories
  // ---------------------------------------------------------------------------

  useEffect(() => {
    (async () => {
      setCatLoading(true);
      setCatError(null);
      try {
        const res = await fetch("/api/help/categories", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || "Failed to load categories");
        setCategories(json.categories);
      } catch (err: any) {
        setCatError(err?.message || "Failed to load");
      } finally {
        setCatLoading(false);
      }
    })();
  }, []);

  // ---------------------------------------------------------------------------
  // Load articles for a category
  // ---------------------------------------------------------------------------

  const loadCategoryArticles = useCallback(async (catSlug: string) => {
    setArtLoading(true);
    try {
      const res = await fetch(`/api/help/articles?categorySlug=${catSlug}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to load articles");
      setArticles(json.articles);
    } catch {
      setArticles([]);
    } finally {
      setArtLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view.type === "category") {
      loadCategoryArticles(view.slug);
    }
  }, [view, loadCategoryArticles]);

  // ---------------------------------------------------------------------------
  // Load single article
  // ---------------------------------------------------------------------------

  const loadArticle = useCallback(async (slug: string) => {
    setArtDetailLoading(true);
    try {
      const res = await fetch(`/api/help/articles/${slug}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Failed to load article");
      setArticle(json.article);
    } catch {
      setArticle(null);
    } finally {
      setArtDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view.type === "article") {
      loadArticle(view.slug);
    }
  }, [view, loadArticle]);

  // ---------------------------------------------------------------------------
  // Search (debounced)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/help/articles?search=${encodeURIComponent(searchQuery.trim())}`,
          { cache: "no-store" },
        );
        const json = await res.json().catch(() => null);
        if (res.ok) setSearchResults(json.articles);
      } catch {
        /* ignore */
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ---------------------------------------------------------------------------
  // Format date
  // ---------------------------------------------------------------------------

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // ---------------------------------------------------------------------------
  // Render: Categories grid (default)
  // ---------------------------------------------------------------------------

  if (view.type === "categories") {
    const isSearching = searchQuery.trim().length > 0;

    return (
      <div>
        {/* Hero */}
        <section className="mb-8 text-center">
          <h1 className="font-brand text-3xl font-semibold tracking-tight text-[var(--bb-secondary)]">
            Help Center
          </h1>
          <p className="mt-2 text-sm text-[var(--bb-text-secondary)]">
            Find answers and guides to get the most out of BrandBite.
          </p>
          <div className="mx-auto mt-4 max-w-md">
            <FormInput
              type="text"
              placeholder="Search articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              search
            />
          </div>
        </section>

        {/* Search results */}
        {isSearching && (
          <section>
            {searching ? (
              <LoadingState message="Searching..." display="inline" />
            ) : searchResults.length === 0 ? (
              <p className="text-center text-sm text-[var(--bb-text-tertiary)]">
                No articles found for &quot;{searchQuery}&quot;
              </p>
            ) : (
              <div className="mx-auto max-w-2xl space-y-2">
                <p className="mb-3 text-xs font-medium text-[var(--bb-text-tertiary)]">
                  {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
                </p>
                {searchResults.map((a) => (
                  <div
                    key={a.id}
                    onClick={() =>
                      setView({
                        type: "article",
                        slug: a.slug,
                        catSlug: a.categorySlug,
                        catName: a.categoryName,
                      })
                    }
                    className="cursor-pointer rounded-xl border border-[var(--bb-border)] bg-white px-4 py-3 transition-colors hover:bg-[var(--bb-bg-warm)]"
                  >
                    <h3 className="text-sm font-semibold text-[var(--bb-secondary)]">
                      {a.title}
                    </h3>
                    {a.excerpt && (
                      <p className="mt-1 text-xs text-[var(--bb-text-secondary)] line-clamp-2">
                        {a.excerpt}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-[var(--bb-text-tertiary)]">
                      {a.categoryName}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Category cards */}
        {!isSearching && (
          <section>
            {catLoading ? (
              <LoadingState message="Loading help center..." />
            ) : catError ? (
              <InlineAlert variant="error">{catError}</InlineAlert>
            ) : categories.length === 0 ? (
              <EmptyState
                title="No help articles yet"
                description="Help articles will appear here once they are published."
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    onClick={() =>
                      setView({
                        type: "category",
                        slug: cat.slug,
                        name: cat.name,
                        icon: cat.icon,
                      })
                    }
                    className="cursor-pointer rounded-2xl border border-[var(--bb-border)] bg-white px-5 py-5 shadow-sm transition-shadow hover:shadow-md"
                  >
                    {cat.icon && <div className="mb-2 text-2xl">{cat.icon}</div>}
                    <h3 className="text-sm font-semibold text-[var(--bb-secondary)]">
                      {cat.name}
                    </h3>
                    {cat.description && (
                      <p className="mt-1 text-xs text-[var(--bb-text-secondary)] line-clamp-2">
                        {cat.description}
                      </p>
                    )}
                    <p className="mt-2 text-[11px] text-[var(--bb-text-tertiary)]">
                      {cat.articleCount} article{cat.articleCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Category article list
  // ---------------------------------------------------------------------------

  if (view.type === "category") {
    return (
      <div>
        <button
          onClick={() => {
            setView({ type: "categories" });
            setSearchQuery("");
          }}
          className="mb-4 flex items-center gap-1 text-sm text-[var(--bb-text-secondary)] hover:text-[var(--bb-secondary)]"
        >
          &larr; Back to categories
        </button>

        <div className="mb-6">
          <h2 className="font-brand text-xl font-semibold tracking-tight text-[var(--bb-secondary)]">
            {view.icon && <span className="mr-2">{view.icon}</span>}
            {view.name}
          </h2>
        </div>

        {artLoading ? (
          <LoadingState message="Loading articles..." />
        ) : articles.length === 0 ? (
          <EmptyState
            title="No articles in this category"
            description="Check back later for new content."
          />
        ) : (
          <div className="space-y-2">
            {articles.map((a) => (
              <div
                key={a.id}
                onClick={() =>
                  setView({
                    type: "article",
                    slug: a.slug,
                    catSlug: view.slug,
                    catName: view.name,
                  })
                }
                className="cursor-pointer rounded-xl border border-[var(--bb-border)] bg-white px-4 py-3 transition-colors hover:bg-[var(--bb-bg-warm)]"
              >
                <h3 className="text-sm font-semibold text-[var(--bb-secondary)]">
                  {a.title}
                </h3>
                {a.excerpt && (
                  <p className="mt-1 text-xs text-[var(--bb-text-secondary)] line-clamp-2">
                    {a.excerpt}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Article detail
  // ---------------------------------------------------------------------------

  return (
    <div>
      <button
        onClick={() => {
          const cat = categories.find((c) => c.slug === view.catSlug);
          setView({
            type: "category",
            slug: view.catSlug,
            name: view.catName,
            icon: cat?.icon ?? null,
          });
        }}
        className="mb-4 flex items-center gap-1 text-sm text-[var(--bb-text-secondary)] hover:text-[var(--bb-secondary)]"
      >
        &larr; Back to {view.catName}
      </button>

      {artDetailLoading ? (
        <LoadingState message="Loading article..." />
      ) : !article ? (
        <EmptyState title="Article not found" description="This article may have been removed." />
      ) : (
        <article className="mx-auto max-w-2xl">
          <h1 className="font-brand text-2xl font-semibold tracking-tight text-[var(--bb-secondary)]">
            {article.title}
          </h1>
          <p className="mt-1 text-xs text-[var(--bb-text-tertiary)]">
            Last updated {formatDate(article.updatedAt)}
          </p>
          <div className="mt-6">
            <SafeHtml
              html={article.content}
              className="text-sm leading-relaxed text-[var(--bb-secondary)]"
              allowHeadings
            />
          </div>
        </article>
      )}
    </div>
  );
}
