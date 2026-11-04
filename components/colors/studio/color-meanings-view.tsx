// -----------------------------------------------------------------------------
// @file: components/colors/studio/color-meanings-view.tsx
// @purpose: Color families with a detail panel (CMS-managed ColorMeaning). Building
//           a palette carries the selected color, so its HEX is never retyped.
//           MeaningPanel is also used by the per-color page.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  createStudioPalette,
  describeColor,
  formatHex,
  normalizeHex,
  readableTextOn,
  suggestPairings,
} from "@/lib/colors";
import { COLOR_FAMILIES } from "@/lib/colors/color-families";
import { MEANING_GUIDANCE } from "@/lib/colors/meaning-guidance";

import { HexField } from "./hex-field";
import { CheckIcon, CopyIcon } from "./icons";
import { usePaletteOpener } from "./open-palette";
import { CopyRow, STUDIO_FIELD } from "./palette-parts";
import { StudioButton } from "./studio-button";
import { WorkspacePanel } from "./studio-shell";
import { useSavedPalettes } from "./use-saved-palettes";
import { useStudioCopy } from "./use-studio-copy";

export type MeaningSummary = {
  id: string;
  name: string;
  slug: string;
  hex: string;
  summary: string | null;
  associations: string[];
};

export type MeaningDetail = MeaningSummary & {
  meaning: string | null;
  samplePalettes: string[][];
};

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Colors from the sample palettes, other than the color itself. */
function pairingsFor(meaning: MeaningSummary, detail: MeaningDetail | null): string[] {
  const own = normalizeHex(meaning.hex);
  const seen = new Set<string>();
  for (const palette of detail?.samplePalettes ?? []) {
    for (const color of palette) {
      const hex = normalizeHex(color);
      if (hex && hex !== own) seen.add(hex);
    }
  }
  return Array.from(seen).slice(0, 4);
}

export function MeaningPanel({
  meaning,
  detail,
  showReadMore = true,
  pairings: pairingsOverride,
  note,
}: {
  meaning: MeaningSummary;
  detail: MeaningDetail | null;
  showReadMore?: boolean;
  /** Colors to suggest instead of the CMS sample palettes. */
  pairings?: string[];
  /** Shown under the summary, e.g. to explain where a description came from. */
  note?: string;
}) {
  const store = useSavedPalettes();
  const { copy, isCopied } = useStudioCopy();
  const opener = usePaletteOpener(async (active) => (await store.save(active)).ok);

  const guidance = MEANING_GUIDANCE[meaning.slug];
  const pairings = pairingsOverride ?? pairingsFor(meaning, detail);
  const hex = normalizeHex(meaning.hex) ?? "#000000";

  const buildPalette = () => {
    opener.requestOpen(
      createStudioPalette({
        name: `${meaning.name} palette`,
        hexes: [hex, ...pairings],
        sourceTool: "meanings",
      }),
      "/colors/color-palette-generator",
    );
  };

  return (
    <aside
      aria-label={`${meaning.name} details`}
      className="min-w-0 rounded-2xl border border-[var(--cs-border)] p-6 max-[767px]:p-4"
    >
      <h2 className="text-2xl leading-8 font-semibold">{meaning.name}</h2>
      <div
        className="mt-4 h-20 rounded-[10px] border border-[var(--cs-border)]"
        style={{ backgroundColor: hex }}
      />
      <div className="mt-2">
        <CopyRow label="HEX" value={formatHex(hex)} />
      </div>

      {meaning.associations.length > 0 ? (
        <>
          <h3 className="mt-4 text-base leading-6 font-semibold">Key associations</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {meaning.associations.slice(0, 3).map((association) => (
              <li
                key={association}
                className="rounded-full bg-[var(--cs-soft)] px-3 py-1 text-sm leading-5 font-medium text-[var(--cs-soft-text)]"
              >
                {capitalize(association)}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {meaning.summary ? <p className="mt-4 text-sm leading-5">{meaning.summary}</p> : null}
      {note ? <p className="mt-2 text-sm leading-5 text-[var(--cs-muted)]">{note}</p> : null}

      {guidance ? (
        <>
          <h3 className="mt-4 text-base leading-6 font-semibold">Works well for</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {guidance.worksWellFor.map((use) => (
              <li
                key={use}
                className="rounded-[10px] border border-[var(--cs-border)] px-3 py-1.5 text-sm leading-5 font-medium"
              >
                {use}
              </li>
            ))}
          </ul>
          <h3 className="mt-4 text-base leading-6 font-semibold">Cultural context</h3>
          <p className="mt-1 text-sm leading-5 text-[var(--cs-muted)]">
            {guidance.culturalContext}
          </p>
        </>
      ) : null}

      {pairings.length > 0 ? (
        <>
          <h3 className="mt-4 text-base leading-6 font-semibold">Pair it with</h3>
          <ul className="mt-2 grid grid-cols-4 gap-2">
            {pairings.map((pairing) => {
              const label = formatHex(pairing);
              return (
                <li key={pairing}>
                  <button
                    type="button"
                    aria-label={`Copy ${label}`}
                    onClick={() => void copy(label, pairing, label)}
                    className="flex h-14 w-full cursor-copy items-center justify-center rounded-[10px] border border-[var(--cs-border)]"
                    style={{ backgroundColor: pairing, color: readableTextOn(pairing) }}
                  >
                    {isCopied(pairing) ? <CheckIcon /> : <CopyIcon />}
                  </button>
                  <span className="mt-1 block truncate text-center font-mono text-xs leading-4 select-text">
                    {label}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      <div className="mt-6 flex flex-col gap-2">
        <StudioButton onClick={buildPalette}>
          Build {/^[aeiou]/i.test(meaning.name) ? "an" : "a"} {meaning.name.toLowerCase()} palette
        </StudioButton>
        {showReadMore ? (
          <Link
            href={`/colors/color-meanings/${meaning.slug}`}
            className="py-2 text-center text-sm leading-5 font-medium text-[var(--cs-brand-strong)] underline"
          >
            Read more about {meaning.name.toLowerCase()}
          </Link>
        ) : null}
      </div>
      {opener.dialog}
    </aside>
  );
}

const BUILT_IN_PREFIX = "family-";

export function ColorMeaningsView() {
  const [meanings, setMeanings] = useState<MeaningSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [lookupHex, setLookupHex] = useState("#7a9e7e");
  const [lookupActive, setLookupActive] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, MeaningDetail>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/color-meanings");
        const json = await res.json().catch(() => null);
        if (!cancelled && res.ok && Array.isArray(json?.meanings)) setMeanings(json.meanings);
      } catch {
        // The built-in families still show.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // CMS entries first; built-in families fill the gaps.
  const families = useMemo<MeaningSummary[]>(() => {
    const cmsSlugs = new Set(meanings.map((m) => m.slug));
    return [
      ...meanings,
      ...COLOR_FAMILIES.filter((f) => !cmsSlugs.has(f.slug)).map((f) => ({
        ...f,
        id: `${BUILT_IN_PREFIX}${f.slug}`,
      })),
    ];
  }, [meanings]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return families;
    return families.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.summary ?? "").toLowerCase().includes(q) ||
        m.associations.some((a) => a.toLowerCase().includes(q)),
    );
  }, [families, query]);

  const selected = visible.find((m) => m.slug === selectedSlug) ?? visible[0] ?? null;
  const selectedIsCms = selected !== null && !selected.id.startsWith(BUILT_IN_PREFIX);
  const selectedDetailSlug = selectedIsCms ? selected.slug : null;

  const lookup = useMemo(() => {
    if (!lookupActive) return null;
    const { name, family } = describeColor(lookupHex);
    const base = families.find((f) => f.slug === family);
    return {
      meaning: {
        id: "lookup",
        name,
        slug: family,
        hex: lookupHex,
        summary: base?.summary ?? null,
        associations: base?.associations ?? [],
      },
      familyName: base?.name ?? family,
    };
  }, [lookupActive, lookupHex, families]);
  const hasDetail = selectedDetailSlug ? details[selectedDetailSlug] !== undefined : true;

  useEffect(() => {
    if (!selectedDetailSlug || hasDetail) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/color-meanings/${selectedDetailSlug}`);
        const json = await res.json().catch(() => null);
        if (!cancelled && res.ok && json?.meaning) {
          setDetails((prev) => ({ ...prev, [selectedDetailSlug]: json.meaning }));
        }
      } catch {
        // The panel still works without pairings.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDetailSlug, hasDetail]);

  return (
    <WorkspacePanel>
      <label className="block text-sm leading-5 font-medium">
        Find a color or feeling
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className={`${STUDIO_FIELD} mt-2 block w-full`}
        />
      </label>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl bg-[var(--cs-soft)] p-4">
        <div className="min-w-[240px] flex-1">
          <HexField
            label="Look up any color"
            value={lookupHex}
            onChange={(hex) => {
              setLookupHex(hex);
              setLookupActive(true);
            }}
          />
        </div>
        <StudioButton onClick={() => setLookupActive(true)}>Find its meaning</StudioButton>
        <p className="w-full text-sm leading-5">
          Get a name for any HEX, with the associations of its closest color family.
        </p>
      </div>

      {loading ? (
        <p aria-busy="true" className="py-16 text-center text-sm leading-5 text-[var(--cs-muted)]">
          Loading colors…
        </p>
      ) : visible.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-base leading-6 font-medium">No colors match your search.</p>
          <div className="mt-4">
            <StudioButton variant="secondary" onClick={() => setQuery("")}>
              Clear search
            </StudioButton>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-[minmax(0,7fr)_minmax(0,5fr)] items-start gap-6 max-[1023px]:grid-cols-1">
          <div className="min-w-0">
            <h2 className="text-2xl leading-8 font-semibold">Color families</h2>
            <p className="mt-1 mb-4 text-sm leading-5 text-[var(--cs-muted)]">
              Choose a color to see its associations and how to use it.
            </p>
            <ul className="grid grid-cols-2 gap-4 max-[479px]:grid-cols-1">
              {visible.map((meaning) => {
                const isSelected = !lookup && meaning.slug === selected?.slug;
                return (
                  <li key={meaning.id}>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => {
                        setSelectedSlug(meaning.slug);
                        setLookupActive(false);
                      }}
                      className={`block w-full overflow-hidden rounded-2xl border text-left ${
                        isSelected
                          ? "border-[var(--cs-text)] outline-2 outline-offset-2 outline-[var(--cs-text)]"
                          : "border-[var(--cs-border)] hover:border-[var(--cs-text)]"
                      }`}
                    >
                      <span
                        className="flex h-20 items-start justify-end p-2"
                        style={{
                          backgroundColor: meaning.hex,
                          color: readableTextOn(meaning.hex),
                        }}
                      >
                        {isSelected ? <CheckIcon /> : null}
                      </span>
                      <span className="block p-3">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="text-lg leading-[26px] font-semibold">
                            {meaning.name}
                          </span>
                          <span className="font-mono text-xs leading-4 text-[var(--cs-muted)]">
                            {formatHex(meaning.hex)}
                          </span>
                        </span>
                        <span className="mt-1 block text-sm leading-5 text-[var(--cs-muted)]">
                          {meaning.associations.slice(0, 3).map(capitalize).join(" · ")}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          {lookup ? (
            <MeaningPanel
              meaning={lookup.meaning}
              detail={null}
              showReadMore={false}
              pairings={suggestPairings(lookupHex)}
              note={`Based on the ${lookup.familyName} color family, as a starting point.`}
            />
          ) : selected ? (
            <MeaningPanel
              meaning={selected}
              detail={details[selected.slug] ?? null}
              showReadMore={selectedIsCms}
              pairings={selectedIsCms ? undefined : suggestPairings(selected.hex)}
            />
          ) : null}
        </div>
      )}
    </WorkspacePanel>
  );
}
