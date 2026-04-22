// -----------------------------------------------------------------------------
// @file: app/showcase/page.tsx
// @purpose: Showcase listing page — portfolio grid with category filtering
// -----------------------------------------------------------------------------

"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ShowcaseWork = {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  clientName: string | null;
  category: string | null;
  tags: string[];
  thumbnailUrl: string | null;
  sortOrder: number;
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ShowcasePage() {
  const [works, setWorks] = useState<ShowcaseWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");

  // Fetch published showcase works
  useEffect(() => {
    async function fetchWorks() {
      try {
        const res = await fetch("/api/showcase");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setWorks(data.works ?? []);
      } catch (err) {
        console.error("[showcase] fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchWorks();
  }, []);

  // Derive categories from works
  const categories = ["All", ...new Set(works.map((w) => w.category).filter(Boolean))] as string[];

  // Filter works by active category
  const filtered =
    activeCategory === "All" ? works : works.filter((w) => w.category === activeCategory);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader activePage="Showcase" />

      {/* ----------------------------------------------------------------- */}
      {/* Hero                                                              */}
      {/* ----------------------------------------------------------------- */}
      <section className="relative overflow-hidden bg-white py-20 sm:py-24">
        {/* Bitemark background */}
        <img
          src="/bitemark.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 h-full w-auto max-w-none object-cover object-left-top select-none"
        />

        <div className="relative mx-auto max-w-6xl px-6 text-center">
          <p className="text-sm font-bold tracking-widest text-[var(--bb-primary)] uppercase">
            SHOWCASE
          </p>
          <h1 className="font-brand mt-3 text-4xl font-bold text-[var(--bb-secondary)] sm:text-5xl">
            Our creative work
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-[var(--bb-text-secondary)]">
            See what we&apos;ve designed for brands like yours.
          </p>
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* Category filter + grid                                            */}
      {/* ----------------------------------------------------------------- */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-20 sm:pb-24">
        {/* Category pills */}
        {categories.length > 1 && (
          <div className="mb-10 flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                  activeCategory === cat
                    ? "bg-[var(--bb-primary)] text-white"
                    : "bg-[var(--bb-bg-warm)] text-[var(--bb-text-secondary)] hover:bg-[#eae6f1]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="py-20 text-center text-[var(--bb-text-secondary)]">
            Loading showcase&hellip;
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="py-20 text-center text-[var(--bb-text-secondary)]">
            No showcase works yet.
          </div>
        )}

        {/* Portfolio grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((work) => (
              <Link
                key={work.id}
                href={`/showcase/${work.slug}`}
                className="group overflow-hidden rounded-xl border border-[var(--bb-border-subtle)] bg-white transition-shadow hover:shadow-lg"
              >
                {/* Thumbnail */}
                <div className="relative aspect-[4/3] bg-[#e8dff5]">
                  {work.thumbnailUrl ? (
                    <Image
                      src={work.thumbnailUrl}
                      alt={work.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="40"
                        height="40"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-[var(--bb-text-secondary)] opacity-30"
                      >
                        <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-5">
                  <h3 className="font-bold text-[var(--bb-secondary)]">{work.title}</h3>
                  {work.subtitle && (
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--bb-text-secondary)]">
                      {work.subtitle}
                    </p>
                  )}
                  {work.category && (
                    <span className="mt-3 inline-block rounded-full bg-[#eae6f1] px-3 py-1 text-xs text-[var(--bb-text-secondary)]">
                      {work.category}
                    </span>
                  )}
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
