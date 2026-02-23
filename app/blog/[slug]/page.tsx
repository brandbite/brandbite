// -----------------------------------------------------------------------------
// @file: app/blog/[slug]/page.tsx
// @purpose: Blog detail page — renders a single published blog post
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

type BlogPost = {
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

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;

    fetch(`/api/blog/${slug}`)
      .then((res) => {
        if (!res.ok) {
          setNotFound(true);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.post) {
          setPost(data.post);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <div className="min-h-screen bg-white text-[var(--bb-secondary)]">
      <SiteHeader activePage="Blog" />

      {/* ----------------------------------------------------------------- */}
      {/* Loading state                                                     */}
      {/* ----------------------------------------------------------------- */}
      {loading && (
        <div className="flex items-center justify-center py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--bb-border)] border-t-[var(--bb-primary)]" />
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Not found                                                         */}
      {/* ----------------------------------------------------------------- */}
      {!loading && notFound && (
        <div className="mx-auto max-w-3xl px-6 py-32 text-center">
          <h1 className="font-brand text-3xl font-bold text-[var(--bb-secondary)]">
            Post not found
          </h1>
          <p className="mt-3 text-[var(--bb-text-secondary)]">
            The blog post you&apos;re looking for doesn&apos;t exist or has been removed.
          </p>
          <Link
            href="/blog"
            className="mt-6 inline-block text-sm font-medium text-[var(--bb-primary)] transition-colors hover:underline"
          >
            &larr; Back to Blog
          </Link>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Post content                                                      */}
      {/* ----------------------------------------------------------------- */}
      {!loading && post && (
        <>
          {/* Hero image */}
          {post.heroUrl && (
            <div className="mx-auto max-h-[500px] overflow-hidden">
              <img src={post.heroUrl} alt={post.title} className="h-full w-full object-cover" />
            </div>
          )}

          {/* Article wrapper */}
          <div className="mx-auto max-w-3xl px-6 py-12">
            {/* Back link */}
            <Link
              href="/blog"
              className="inline-block text-sm font-medium text-[var(--bb-primary)] transition-colors hover:underline"
            >
              &larr; Back to Blog
            </Link>

            {/* Category badge */}
            {post.category && (
              <span className="mt-4 inline-block rounded-full bg-[var(--bb-primary-light)] px-2.5 py-0.5 text-xs font-medium text-[var(--bb-primary)]">
                {post.category}
              </span>
            )}

            {/* Title */}
            <h1 className="font-brand mt-4 text-3xl font-bold text-[var(--bb-secondary)] sm:text-4xl lg:text-5xl">
              {post.title}
            </h1>

            {/* Meta row */}
            <div className="mt-4 flex items-center gap-3 text-sm text-[var(--bb-text-secondary)]">
              {post.authorName && (
                <>
                  <span className="font-medium">{post.authorName}</span>
                  <span>&middot;</span>
                </>
              )}
              <span>{formatDate(post.publishedAt)}</span>
            </div>

            {/* Separator */}
            <div className="my-8 border-t border-[var(--bb-border-subtle)]" />

            {/* Body */}
            <article
              className="prose prose-lg prose-headings:font-brand prose-headings:text-[var(--bb-secondary)] prose-p:text-[var(--bb-text-secondary)] prose-p:leading-relaxed prose-a:text-[var(--bb-primary)] prose-a:no-underline hover:prose-a:underline prose-strong:text-[var(--bb-secondary)] prose-li:text-[var(--bb-text-secondary)] max-w-none"
              dangerouslySetInnerHTML={{ __html: post.body }}
            />
          </div>

          {/* --------------------------------------------------------------- */}
          {/* CTA section                                                      */}
          {/* --------------------------------------------------------------- */}
          <section className="bg-[var(--bb-bg-page)] py-20 sm:py-24">
            <div className="mx-auto max-w-3xl px-6 text-center">
              <h2 className="font-brand text-2xl font-bold text-[var(--bb-secondary)] sm:text-3xl">
                Enjoyed this article?
              </h2>
              <p className="mt-3 text-[var(--bb-text-secondary)]">
                Explore more insights from our blog or see our creative work in action.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  href="/blog"
                  className="rounded-full border border-[var(--bb-secondary)] px-6 py-2.5 text-sm font-semibold text-[var(--bb-secondary)] transition-colors hover:bg-[var(--bb-secondary)] hover:text-white"
                >
                  More articles
                </Link>
                <Link
                  href="/showcase"
                  className="rounded-full bg-[var(--bb-primary)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--bb-primary-hover)]"
                >
                  View showcase
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
