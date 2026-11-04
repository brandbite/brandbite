// -----------------------------------------------------------------------------
// @file: components/colors/studio/palette-ideas-view.tsx
// @purpose: Curated palette gallery (CMS-managed PaletteIdea). Search and tag work
//           together. A card separates copying one color, copying the palette,
//           saving it, and opening it in the generator.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/ui/toast-provider";
import {
  createStudioPalette,
  formatHex,
  normalizeHex,
  readableTextOn,
  type StudioPalette,
} from "@/lib/colors";

import { BookmarkIcon, CheckIcon, CopyIcon } from "./icons";
import { usePaletteOpener } from "./open-palette";
import { STUDIO_FIELD } from "./palette-parts";
import { StudioButton } from "./studio-button";
import { WorkspacePanel } from "./studio-shell";
import { useSavedPalettes } from "./use-saved-palettes";
import { useStudioCopy } from "./use-studio-copy";

type PaletteIdea = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  colors: string[];
  tags: string[];
};

type LoadState = "loading" | "ready" | "error";
type SortKey = "featured" | "name";

function toStudioPalette(idea: PaletteIdea): StudioPalette {
  return createStudioPalette({
    name: idea.title,
    hexes: idea.colors.map((hex) => normalizeHex(hex) ?? "#000000"),
    sourceTool: "ideas",
    tags: idea.tags,
  });
}

export function PaletteIdeasView() {
  const store = useSavedPalettes();
  const { copy, isCopied } = useStudioCopy();
  const { showToast } = useToast();

  const [ideas, setIdeas] = useState<PaletteIdea[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState("All");
  const [sort, setSort] = useState<SortKey>("featured");
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/palette-ideas");
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && Array.isArray(json?.ideas)) {
          setIdeas(json.ideas);
          setLoadState("ready");
        } else {
          setLoadState("error");
        }
      } catch {
        if (!cancelled) setLoadState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const tags = useMemo(
    () => ["All", ...Array.from(new Set(ideas.flatMap((idea) => idea.tags))).sort()],
    [ideas],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = ideas.filter(
      (idea) =>
        (activeTag === "All" || idea.tags.includes(activeTag)) &&
        (!q ||
          idea.title.toLowerCase().includes(q) ||
          (idea.summary ?? "").toLowerCase().includes(q) ||
          idea.tags.some((tag) => tag.toLowerCase().includes(q))),
    );
    return sort === "name"
      ? [...filtered].sort((a, b) => a.title.localeCompare(b.title))
      : filtered;
  }, [ideas, query, activeTag, sort]);

  const savePalette = async (idea: PaletteIdea) => {
    setSaveError(null);
    const result = await store.createMany([toStudioPalette(idea)]);
    if (result.ok) {
      showToast({ type: "success", title: `Saved ${idea.title}`, durationMs: 3000 });
    } else {
      setSaveError(result.message);
    }
  };

  const opener = usePaletteOpener(async (active) => (await store.save(active)).ok);

  return (
    <WorkspacePanel>
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[220px] flex-1 text-sm leading-5 font-medium">
          Search palettes
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={`${STUDIO_FIELD} mt-2 block w-full`}
          />
        </label>
        <label className="text-sm leading-5 font-medium">
          Sort by
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className={`${STUDIO_FIELD} mt-2 block`}
          >
            <option value="featured">Featured</option>
            <option value="name">Name</option>
          </select>
        </label>
      </div>

      <div role="group" aria-label="Filter by tag" className="mt-4 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            aria-pressed={activeTag === tag}
            onClick={() => setActiveTag(tag)}
            className={`h-11 rounded-full px-4 text-sm leading-5 font-medium transition-colors ${
              activeTag === tag
                ? "bg-[var(--cs-brand-strong)] text-white"
                : "border border-[var(--cs-border)] hover:border-[var(--cs-text)]"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {saveError ? (
        <p role="alert" className="mt-4 text-sm leading-5 text-[var(--cs-danger)]">
          {saveError}
        </p>
      ) : null}

      {loadState === "loading" ? (
        <p aria-busy="true" className="py-16 text-center text-sm leading-5 text-[var(--cs-muted)]">
          Loading palettes…
        </p>
      ) : loadState === "error" ? (
        <div role="alert" className="py-16 text-center">
          <p className="text-base leading-6">Palettes couldn&apos;t be loaded.</p>
          <div className="mt-4">
            <StudioButton
              variant="secondary"
              onClick={() => {
                setLoadState("loading");
                setReloadKey((key) => key + 1);
              }}
            >
              Try again
            </StudioButton>
          </div>
        </div>
      ) : ideas.length === 0 ? (
        <p className="py-16 text-center text-base leading-6">
          No palettes published yet. Check back soon.
        </p>
      ) : visible.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-base leading-6 font-medium">No palettes match your search.</p>
          <div className="mt-4">
            <StudioButton
              variant="secondary"
              onClick={() => {
                setQuery("");
                setActiveTag("All");
              }}
            >
              Clear filters
            </StudioButton>
          </div>
        </div>
      ) : (
        <>
          <h2 className="mt-6 text-2xl leading-8 font-semibold">
            {visible.length} {visible.length === 1 ? "palette" : "palettes"} to make your own
          </h2>
          <ul className="mt-4 grid grid-cols-3 gap-6 max-[1023px]:grid-cols-2 max-[639px]:grid-cols-1">
            {visible.map((idea) => (
              <li
                key={idea.id}
                className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--cs-border)]"
              >
                <div className="flex h-24">
                  {idea.colors.map((hex, index) => {
                    const label = formatHex(hex);
                    const key = `${idea.id}-${index}`;
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-label={`Copy ${label}`}
                        onClick={() => void copy(label, key, label)}
                        className="group flex min-w-0 flex-1 cursor-copy items-center justify-center transition-[flex] hover:flex-[2] focus-visible:flex-[2]"
                        style={{ backgroundColor: hex, color: readableTextOn(hex) }}
                      >
                        {isCopied(key) ? (
                          <CheckIcon />
                        ) : (
                          <span className="hidden font-mono text-xs leading-4 group-hover:inline group-focus-visible:inline">
                            {label}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="text-lg leading-[26px] font-semibold">{idea.title}</h3>
                  {idea.summary ? (
                    <p className="mt-1 text-sm leading-5 text-[var(--cs-muted)]">{idea.summary}</p>
                  ) : null}
                  {idea.tags.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {idea.tags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          aria-label={`Filter by ${tag}`}
                          onClick={() => setActiveTag(tag)}
                          className="min-h-7 rounded-full bg-[var(--cs-soft)] px-2.5 text-sm leading-5 font-medium text-[var(--cs-soft-text)]"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    <StudioButton
                      variant="secondary"
                      icon={<CopyIcon />}
                      onClick={() =>
                        void copy(
                          idea.colors.map((hex) => formatHex(hex)).join(", "),
                          idea.id,
                          idea.title,
                        )
                      }
                    >
                      Copy palette
                    </StudioButton>
                    <StudioButton
                      variant="secondary"
                      icon={<BookmarkIcon />}
                      disabled={store.status !== "ready"}
                      aria-label={`Save ${idea.title}`}
                      onClick={() => void savePalette(idea)}
                    >
                      Save
                    </StudioButton>
                    <StudioButton
                      variant="tertiary"
                      onClick={() =>
                        opener.requestOpen(toStudioPalette(idea), "/colors/color-palette-generator")
                      }
                    >
                      Open in generator
                    </StudioButton>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm leading-5 text-[var(--cs-muted)]">
            Click any swatch to copy its HEX.
          </p>
        </>
      )}
      {opener.dialog}
    </WorkspacePanel>
  );
}
