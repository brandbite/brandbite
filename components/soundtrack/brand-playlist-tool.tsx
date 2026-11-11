// -----------------------------------------------------------------------------
// @file: components/soundtrack/brand-playlist-tool.tsx
// @purpose: The public "Brand playlist generator": pick up to three words
//           that describe a brand and get the playlist made for that mix of
//           moods in Spotify's embedded player ("Bold" + "Calm" gives the
//           Minimal + Bold playlist, not just one of the two). "Try another"
//           steps through the site owner's own lists for the picked moods.
//           Runs in the browser. Styled with the Color Studio (--cs-*) tokens.
// -----------------------------------------------------------------------------

"use client";

import { useMemo, useState } from "react";

import { comboKey, comboLabel } from "@/lib/soundtrack/combos";
import { isMood, type Mood } from "@/lib/soundtrack/moods";

export type ToolPlaylist = { url: string; embedUrl: string; title: string };

export type ToolMood = {
  value: string;
  label: string;
  /** Words a visitor can pick that point at this mood. */
  words: string[];
  /** The site owner's own lists for this mood (extras). */
  playlists: ToolPlaylist[];
};

const MAX_WORDS = 3;

export function BrandPlaylistTool({
  moods,
  mixes,
}: {
  moods: ToolMood[];
  /** The playlist made for each mix of moods, by comboKey ("MINIMAL+BOLD"). */
  mixes: Record<string, ToolPlaylist>;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [index, setIndex] = useState(0);

  // Words in a stable shuffle-free order: one from each mood in turn.
  const words = useMemo(() => {
    const out: { word: string; mood: string }[] = [];
    const longest = Math.max(...moods.map((m) => m.words.length));
    for (let i = 0; i < longest; i++) {
      for (const mood of moods) {
        if (mood.words[i]) out.push({ word: mood.words[i]!, mood: mood.value });
      }
    }
    return out;
  }, [moods]);

  // The moods behind the picked words, in pick order, and every playlist that
  // fits: the one made for the mix first, then the owner's lists per mood.
  const result = useMemo(() => {
    const pickedMoods: Mood[] = [];
    for (const word of picked) {
      const mood = words.find((w) => w.word === word)?.mood;
      if (isMood(mood) && !pickedMoods.includes(mood)) pickedMoods.push(mood);
    }
    if (pickedMoods.length === 0) return null;
    const playlists: ToolPlaylist[] = [];
    const mix = mixes[comboKey(pickedMoods)];
    if (mix) playlists.push(mix);
    for (const mood of pickedMoods) {
      playlists.push(...(moods.find((m) => m.value === mood)?.playlists ?? []));
    }
    return { label: comboLabel(pickedMoods), playlists };
  }, [picked, words, moods, mixes]);

  const toggle = (word: string) => {
    setIndex(0);
    setPicked((prev) =>
      prev.includes(word)
        ? prev.filter((w) => w !== word)
        : prev.length >= MAX_WORDS
          ? prev
          : [...prev, word],
    );
  };

  const playlist =
    result && result.playlists.length > 0
      ? result.playlists[index % result.playlists.length]!
      : null;
  const full = picked.length >= MAX_WORDS;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <section
        aria-labelledby="bp-words"
        className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-8 max-[767px]:p-5"
      >
        <h2 id="bp-words" className="text-2xl leading-8 font-semibold">
          Describe your brand
        </h2>
        <p className="mt-1 text-base text-[var(--cs-muted)]">
          Pick up to {MAX_WORDS} words. <span aria-live="polite">{picked.length} picked.</span>
        </p>
        <ul className="mt-5 flex flex-wrap gap-2.5">
          {words.map(({ word }) => {
            const on = picked.includes(word);
            return (
              <li key={word}>
                <button
                  type="button"
                  aria-pressed={on}
                  disabled={!on && full}
                  onClick={() => toggle(word)}
                  className={`min-h-11 rounded-full border px-4 text-base font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[var(--cs-brand)] focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 ${
                    on
                      ? "border-[#4b3fb0] bg-[#EEE9FF] text-[#49368D]"
                      : "border-[var(--cs-border)] bg-[var(--cs-surface)] hover:border-[var(--cs-text)]"
                  }`}
                >
                  {word}
                </button>
              </li>
            );
          })}
        </ul>
        {picked.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setPicked([]);
              setIndex(0);
            }}
            className="mt-5 text-sm font-medium text-[var(--cs-muted)] underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-[var(--cs-brand)] focus-visible:outline-none"
          >
            Start over
          </button>
        ) : null}
      </section>

      <section
        aria-labelledby="bp-result"
        aria-live="polite"
        className="rounded-2xl border border-[#d5ccf2] bg-[#EEE9FF] p-8 text-[#2B2D33] max-[767px]:p-5"
      >
        <h2 id="bp-result" className="text-2xl leading-8 font-semibold">
          {result ? "Your brand sounds like" : "Your brand's playlist"}
        </h2>
        {result && !playlist ? (
          <p className="mt-2 text-base text-[#5E616E]">
            We don&rsquo;t have a playlist for {result.label} yet. Try a different word.
          </p>
        ) : result && playlist ? (
          <>
            <p className="mt-2 inline-flex rounded-lg bg-[#dcd4fb] px-3 py-1 text-base font-semibold text-[#49368D]">
              {result.label}
            </p>
            <iframe
              key={playlist.embedUrl}
              src={playlist.embedUrl}
              title={`${playlist.title} on Spotify`}
              height={352}
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              className="mt-4 block w-full rounded-xl border-0"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <a
                href={playlist.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-base font-medium text-[#49368D] underline underline-offset-2"
              >
                Open in Spotify <span aria-hidden>↗</span>
                <span className="sr-only">(opens in a new tab)</span>
              </a>
              {result.playlists.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setIndex((i) => i + 1)}
                  className="inline-flex h-11 items-center rounded-lg border border-[#2B2D33] bg-white px-4 text-base font-medium hover:bg-[#f7f4f1] focus-visible:ring-2 focus-visible:ring-[#4b3fb0] focus-visible:outline-none"
                >
                  Try another
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <p className="mt-2 text-base text-[#5E616E]">
            Pick a word or two on the left and a playlist that fits will appear here.
          </p>
        )}
      </section>
    </div>
  );
}
