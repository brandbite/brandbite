// -----------------------------------------------------------------------------
// @file: app/documentation/page.tsx
// @purpose: Documentation hub — resource center with search + audience tabs
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DocCategory = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  icon: string | null;
  audience: "CREATIVE" | "CUSTOMER" | "GENERAL";
  _count: { articles: number };
};

type AudienceTab = "ALL" | "CREATIVE" | "CUSTOMER";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DocumentationHubPage() {
  const [categories, setCategories] = useState<DocCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [audience, setAudience] = useState<AudienceTab>("ALL");

  useEffect(() => {
    fetch("/api/docs/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []))
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return categories.filter((cat) => {
      // Audience filter
      if (audience === "CREATIVE" && cat.audience !== "CREATIVE" && cat.audience !== "GENERAL")
        return false;
      if (audience === "CUSTOMER" && cat.audience !== "CUSTOMER" && cat.audience !== "GENERAL")
        return false;

      // Search filter
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const titleMatch = cat.title.toLowerCase().includes(q);
        const descMatch = cat.description?.toLowerCase().includes(q) ?? false;
        if (!titleMatch && !descMatch) return false;
      }

      return true;
    });
  }, [categories, audience, search]);

  const tabs: { key: AudienceTab; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "CREATIVE", label: "For Creatives" },
    { key: "CUSTOMER", label: "For Customers" },
  ];

  return (
    <div className="min-h-screen bg-white text-[var(--bb-secondary)]">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden bg-white px-6 pt-14 pb-10 sm:pt-20 sm:pb-14">
        <img
          src="/bitemark.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 h-full w-auto max-w-none object-cover object-left-top select-none"
        />
        <div className="relative mx-auto max-w-6xl">
          <p className="text-sm font-bold tracking-widest text-[var(--bb-primary)] uppercase">
            Documentation
          </p>
          <h1 className="font-brand mt-3 text-4xl font-bold tracking-tight text-[var(--bb-secondary)] sm:text-5xl">
            Help Center
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--bb-text-secondary)]">
            Everything you need to know about using the Brandbite platform.
          </p>

          {/* Search */}
          <div className="relative mt-8 max-w-lg">
            <svg
              className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-[var(--bb-text-tertiary)]"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search documentation..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-full border border-[var(--bb-border)] bg-white py-3 pr-4 pl-12 text-sm text-[var(--bb-secondary)] shadow-sm transition-colors outline-none placeholder:text-[var(--bb-text-tertiary)] focus:border-[var(--bb-primary)] focus:ring-2 focus:ring-[var(--bb-primary)]/20"
            />
          </div>
        </div>
      </section>

      {/* Audience tabs + Categories grid */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        {/* Tabs */}
        <div className="mb-8 flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setAudience(t.key)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                audience === t.key
                  ? "bg-[var(--bb-secondary)] text-white"
                  : "border border-[var(--bb-border)] bg-white text-[var(--bb-text-secondary)] hover:border-[var(--bb-secondary)] hover:text-[var(--bb-secondary)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--bb-border)] border-t-[var(--bb-primary)]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-lg text-[var(--bb-text-secondary)]">
              {search.trim()
                ? "No categories match your search."
                : "No documentation categories available yet."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((cat) => (
              <Link
                key={cat.id}
                href={`/documentation/${cat.slug}`}
                className="group rounded-2xl border border-[var(--bb-border)] bg-white px-6 py-6 shadow-sm transition-all hover:border-[var(--bb-primary)] hover:shadow-md"
              >
                {cat.icon && <span className="mb-3 block text-3xl">{cat.icon}</span>}
                <h3 className="text-lg font-bold text-[var(--bb-secondary)] group-hover:text-[var(--bb-primary)]">
                  {cat.title}
                </h3>
                {cat.description && (
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--bb-text-secondary)]">
                    {cat.description}
                  </p>
                )}
                <p className="mt-4 text-xs font-medium text-[var(--bb-text-tertiary)]">
                  {cat._count.articles} {cat._count.articles === 1 ? "article" : "articles"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <SiteFooter />
    </div>
  );
}
