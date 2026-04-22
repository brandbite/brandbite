// -----------------------------------------------------------------------------
// @file: app/blog/page.tsx
// @purpose: Blog listing page — displays all published blog posts
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

type BlogPost = {
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

export default function BlogListingPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/blog")
      .then((res) => res.json())
      .then((data) => setPosts(data.posts ?? []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-white text-[var(--bb-secondary)]">
      <SiteHeader activePage="Blog" />

      {/* ----------------------------------------------------------------- */}
      {/* Hero                                                              */}
      {/* ----------------------------------------------------------------- */}
      <section className="relative overflow-hidden bg-white px-6 pt-14 pb-16 sm:pt-20 sm:pb-20">
        {/* Bitemark background */}
        <img
          src="/bitemark.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 h-full w-auto max-w-none object-cover object-left-top select-none"
        />

        <div className="relative mx-auto max-w-6xl">
          <p className="text-sm font-bold tracking-widest text-[var(--bb-primary)] uppercase">
            Blog
          </p>
          <h1 className="font-brand mt-3 text-4xl font-bold tracking-tight text-[var(--bb-secondary)] sm:text-5xl">
            Insights &amp; inspiration
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--bb-text-secondary)]">
            Design tips, brand strategy, and creative trends from our team.
          </p>
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* Post grid                                                         */}
      {/* ----------------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--bb-border)] border-t-[var(--bb-primary)]" />
          </div>
        ) : posts.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-lg text-[var(--bb-text-secondary)]">
              No blog posts yet. Check back soon!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group overflow-hidden rounded-xl border border-[var(--bb-border-subtle)] bg-white transition-shadow hover:shadow-lg"
              >
                {/* Thumbnail */}
                <div className="relative aspect-[16/9] bg-[#e8dff5]">
                  {post.thumbnailUrl ? (
                    <Image
                      src={post.thumbnailUrl}
                      alt={post.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <div className="text-center">
                        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/40">
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="var(--bb-text-muted)"
                            strokeWidth="1.5"
                          >
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <path d="M21 15l-5-5L5 21" />
                          </svg>
                        </div>
                        <span className="text-xs font-medium text-[var(--bb-text-muted)]">
                          Thumbnail
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-5">
                  {post.category && (
                    <span className="inline-block rounded-full bg-[var(--bb-primary-light)] px-2.5 py-0.5 text-xs font-medium text-[var(--bb-primary)]">
                      {post.category}
                    </span>
                  )}
                  <h2 className="mt-2 line-clamp-2 text-lg font-bold text-[var(--bb-secondary)] transition-colors group-hover:text-[var(--bb-primary)]">
                    {post.title}
                  </h2>
                  {post.excerpt && (
                    <p className="mt-2 line-clamp-3 text-sm text-[var(--bb-text-secondary)]">
                      {post.excerpt}
                    </p>
                  )}

                  {/* Footer: author + date */}
                  <div className="mt-4 flex items-center gap-2 text-sm">
                    {post.authorName && (
                      <>
                        <span className="font-medium text-[var(--bb-secondary)]">
                          {post.authorName}
                        </span>
                        <span className="text-[var(--bb-text-muted)]">&middot;</span>
                      </>
                    )}
                    <span className="text-[var(--bb-text-muted)]">
                      {formatDate(post.publishedAt)}
                    </span>
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
