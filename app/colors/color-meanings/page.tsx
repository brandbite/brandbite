// -----------------------------------------------------------------------------
// @file: app/colors/color-meanings/page.tsx
// @purpose: Encyclopedia hub — grid of published colors linking to per-color
//           meaning pages. Content is CMS-managed (ColorMeaning).
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { readableTextOn, formatHex } from "@/lib/colors";

type MeaningDTO = {
  id: string;
  name: string;
  slug: string;
  hex: string;
  summary: string | null;
  associations: string[];
};

export default function ColorMeaningsHubPage() {
  const [meanings, setMeanings] = useState<MeaningDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/color-meanings");
        const json = await res.json().catch(() => null);
        if (!cancelled && res.ok && Array.isArray(json?.meanings)) setMeanings(json.meanings);
      } catch {
        /* non-fatal */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bb-bg-page)] text-[var(--bb-secondary)]">
      <SiteHeader activePage="Color Tools" />
      <main className="mx-auto max-w-6xl px-4 py-12 md:px-6">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-brand text-3xl font-bold md:text-4xl">Color Meanings</h1>
            <p className="mt-2 max-w-2xl text-[var(--bb-text-secondary)]">
              What colors communicate — psychology, cultural symbolism, and palettes that put each
              color to work.
            </p>
          </div>
          <ThemeToggle />
        </div>

        {loading ? (
          <p className="py-16 text-center text-sm text-[var(--bb-text-tertiary)]">Loading…</p>
        ) : meanings.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--bb-border)] bg-[var(--bb-bg-warm)] px-6 py-16 text-center text-sm text-[var(--bb-text-tertiary)]">
            No colors published yet — check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {meanings.map((m) => (
              <Link
                key={m.id}
                href={`/colors/color-meanings/${m.slug}`}
                className="group overflow-hidden rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)] transition-all hover:border-[var(--bb-primary)] hover:shadow-md"
              >
                <div
                  className="flex h-24 items-end p-3"
                  style={{ backgroundColor: m.hex, color: readableTextOn(m.hex) }}
                >
                  <span className="font-mono text-xs opacity-80">{formatHex(m.hex)}</span>
                </div>
                <div className="p-4">
                  <h2 className="text-base font-semibold text-[var(--bb-secondary)] group-hover:text-[var(--bb-primary)]">
                    {m.name}
                  </h2>
                  {m.summary ? (
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--bb-text-tertiary)]">
                      {m.summary}
                    </p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
