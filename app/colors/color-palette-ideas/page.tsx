// -----------------------------------------------------------------------------
// @file: app/colors/color-palette-ideas/page.tsx
// @purpose: Public curated palette gallery — text search + tag pill filters,
//           per-color copy, copy-all. Content is CMS-managed (PaletteIdea).
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { useClipboard } from "@/components/hooks/use-clipboard";
import { formatHex, readableTextOn } from "@/lib/colors";

type PaletteIdeaDTO = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  colors: string[];
  tags: string[];
};

export default function PaletteIdeasPage() {
  const [ideas, setIdeas] = useState<PaletteIdeaDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string>("All");
  const { copy, isCopied } = useClipboard();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/palette-ideas");
        const json = await res.json().catch(() => null);
        if (!cancelled && res.ok && Array.isArray(json?.ideas)) setIdeas(json.ideas);
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

  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const idea of ideas) for (const t of idea.tags) set.add(t);
    return ["All", ...Array.from(set).sort()];
  }, [ideas]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ideas.filter((idea) => {
      if (activeTag !== "All" && !idea.tags.includes(activeTag)) return false;
      if (!q) return true;
      return (
        idea.title.toLowerCase().includes(q) ||
        (idea.summary ?? "").toLowerCase().includes(q) ||
        idea.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [ideas, query, activeTag]);

  return (
    <div className="min-h-screen bg-[var(--bb-bg-page)] text-[var(--bb-secondary)]">
      <SiteHeader activePage="Color Tools" />
      <main className="mx-auto max-w-6xl px-4 py-12 md:px-6">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-brand text-3xl font-bold md:text-4xl">Color Palette Ideas</h1>
            <p className="mt-2 max-w-2xl text-[var(--bb-text-secondary)]">
              Curated palettes ready to drop into your next project. Click a color to copy it, or
              copy the whole palette.
            </p>
          </div>
          <ThemeToggle />
        </div>

        {/* Search + tag filters */}
        <div className="mb-8 space-y-4">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search palettes…"
            aria-label="Search palettes"
            className="w-full max-w-md rounded-full border border-[var(--bb-border-input)] bg-[var(--bb-bg-page)] px-4 py-2 text-sm text-[var(--bb-secondary)] outline-none placeholder:text-[var(--bb-text-muted)] focus:border-[var(--bb-primary)]"
          />
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(tag)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  activeTag === tag
                    ? "bg-[var(--bb-primary)] text-white"
                    : "border border-[var(--bb-border)] bg-[var(--bb-bg-warm)] text-[var(--bb-text-secondary)] hover:border-[var(--bb-primary)] hover:text-[var(--bb-primary)]"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="py-16 text-center text-sm text-[var(--bb-text-tertiary)]">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--bb-border)] bg-[var(--bb-bg-warm)] px-6 py-16 text-center text-sm text-[var(--bb-text-tertiary)]">
            {ideas.length === 0
              ? "No palettes published yet — check back soon."
              : "No palettes match your search."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((idea) => (
              <div
                key={idea.id}
                className="overflow-hidden rounded-2xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)]"
              >
                <div className="flex h-24">
                  {idea.colors.map((hex, i) => (
                    <button
                      key={`${hex}-${i}`}
                      type="button"
                      title={`Copy ${formatHex(hex)}`}
                      onClick={() => void copy(formatHex(hex), `${idea.id}-${i}`)}
                      className="flex flex-1 items-center justify-center text-xs font-semibold transition-[flex] hover:flex-[1.5]"
                      style={{ backgroundColor: hex, color: readableTextOn(hex) }}
                    >
                      {isCopied(`${idea.id}-${i}`) ? "✓" : ""}
                    </button>
                  ))}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-semibold text-[var(--bb-secondary)]">
                      {idea.title}
                    </h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void copy(idea.colors.map((c) => formatHex(c)).join(", "), idea.id)
                      }
                    >
                      {isCopied(idea.id) ? "Copied!" : "Copy all"}
                    </Button>
                  </div>
                  {idea.summary ? (
                    <p className="mt-1 text-sm text-[var(--bb-text-tertiary)]">{idea.summary}</p>
                  ) : null}
                  {idea.tags.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {idea.tags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setActiveTag(tag)}
                          className="rounded-full bg-[var(--bb-bg-warm)] px-2 py-0.5 text-[11px] font-medium text-[var(--bb-text-tertiary)] hover:text-[var(--bb-primary)]"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
