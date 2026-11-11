// -----------------------------------------------------------------------------
// @file: components/engagement/soundtrack-card.tsx
// @purpose: The creative's soundtrack card, under the timer while a request
//           is in progress. Shows the brand's soundtrack when the customer
//           picked one, and brandbite's suggestion for the request's mood.
//
//           - Play swaps the row for Spotify's own embedded player.
//           - The mood chip opens a menu to pick another mood, or to stop
//             music suggestions altogether (saved on the creative's account).
//           - × hides the card for this request in this browser.
//
//           Loads itself and renders nothing when the owner's switches are
//           off or there is nothing to play.
// -----------------------------------------------------------------------------

"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

type Playlist = { url: string; embedUrl: string; title: string; coverUrl: string | null };

type Soundtrack = {
  enabled: boolean;
  brand?: Playlist | null;
  mood?: { value: string; label: string };
  moods?: { value: string; label: string }[];
  suggestions?: Playlist[];
  canTurnOffSuggestions?: boolean;
};

const INK = "text-[#4b3fb0] dark:text-[#c3b9fa]";
const FILLED =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#4f4680] px-5 text-base font-semibold text-white hover:bg-[#433b6e] focus-visible:ring-2 focus-visible:ring-[#4b3fb0] focus-visible:ring-offset-2 focus-visible:outline-none";
const OUTLINED =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--av2-text)] bg-[var(--av2-surface)] px-4 text-base font-medium hover:bg-[var(--av2-bg)] focus-visible:ring-2 focus-visible:ring-[#4b3fb0] focus-visible:outline-none";

const dismissKey = (ticketId: string) => `bb-soundtrack-dismissed:${ticketId}`;

function HeadphonesIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
      <rect x="3" y="14" width="4.5" height="6.5" rx="1.6" />
      <rect x="16.5" y="14" width="4.500" height="6.500" rx="1.6" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 3.500v17l14-8.500z" />
    </svg>
  );
}

function Cover({ playlist }: { playlist: Playlist }) {
  return playlist.coverUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- remote Spotify cover, tiny
    <img
      src={playlist.coverUrl}
      alt=""
      referrerPolicy="no-referrer"
      className="h-16 w-16 shrink-0 rounded-lg object-cover"
    />
  ) : (
    <span
      aria-hidden
      className="h-16 w-16 shrink-0 rounded-lg bg-gradient-to-br from-[#d9d0fb] to-[#a99cf2]"
    />
  );
}

function OpenInSpotify({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-sm font-medium underline-offset-2 hover:underline ${INK}`}
    >
      Open in Spotify <span aria-hidden>↗</span>
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

export function SoundtrackCard({ ticketId, status }: { ticketId: string; status: string }) {
  const [data, setData] = useState<Soundtrack | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  /** Which suggestion of the mood is showing ("Try another" moves on). */
  const [index, setIndex] = useState(0);
  /** URL of the playlist whose player is open. */
  const [playing, setPlaying] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement | null>(null);

  const active = status === "IN_PROGRESS";

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(dismissKey(ticketId)) === "1");
    } catch {
      setDismissed(false);
    }
  }, [ticketId]);

  const load = useCallback(
    async (forMood: string | null) => {
      try {
        const query = forMood ? `?mood=${encodeURIComponent(forMood)}` : "";
        const res = await fetch(`/api/creative/tickets/${ticketId}/soundtrack${query}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        setData((await res.json()) as Soundtrack);
        setIndex(0);
      } catch {
        // Music is a nicety: stay quiet on a failed load.
      }
    },
    [ticketId],
  );

  useEffect(() => {
    if (active && !dismissed) void load(mood);
  }, [active, dismissed, load, mood]);

  // Close the mood menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (!active || dismissed || !data?.enabled) return null;

  const brand = data.brand ?? null;
  const suggestions = data.suggestions ?? [];
  const suggestion = suggestions.length > 0 ? suggestions[index % suggestions.length]! : null;
  const moods = data.moods ?? [];
  if (!brand && !suggestion && moods.length === 0) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(dismissKey(ticketId), "1");
    } catch {
      // Private mode: it just comes back on the next visit.
    }
    setDismissed(true);
  };

  const stopSuggestions = async () => {
    setMenuOpen(false);
    try {
      await fetch("/api/creative/soundtrack-preference", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestions: false }),
      });
    } finally {
      setPlaying(null);
      void load(mood);
    }
  };

  const tryAnother = () => {
    setPlaying((current) => (current && current === suggestion?.url ? null : current));
    setIndex((i) => i + 1);
  };

  const row = (playlist: Playlist, kind: "brand" | "suggestion") => {
    const isPlaying = playing === playlist.url;
    const canTryAnother = kind === "suggestion" && suggestions.length > 1;
    if (isPlaying) {
      return (
        <div>
          <iframe
            src={playlist.embedUrl}
            title={`${playlist.title} on Spotify`}
            height={152}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            className="block w-full rounded-xl border-0"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <OpenInSpotify url={playlist.url} />
            {canTryAnother ? (
              <button type="button" onClick={tryAnother} className={OUTLINED}>
                Try another
              </button>
            ) : null}
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-4">
        <Cover playlist={playlist} />
        <div className="min-w-[140px] flex-1">
          <p className="truncate text-lg leading-6 font-semibold">{playlist.title}</p>
          <p className="text-sm text-[var(--av2-text-2)]">
            {kind === "brand" ? "Picked by the customer" : "brandbite suggestion"}
          </p>
          <OpenInSpotify url={playlist.url} />
        </div>
        <div className="flex flex-wrap items-center gap-2 max-sm:w-full [&>button]:max-sm:flex-1">
          <button
            type="button"
            onClick={() => setPlaying(playlist.url)}
            // The brand's pick leads; a suggestion next to it is the quieter button.
            className={kind === "brand" || !brand ? FILLED : OUTLINED}
          >
            <PlayIcon />
            Play
            <span className="sr-only"> {playlist.title}</span>
          </button>
          {canTryAnother ? (
            <button type="button" onClick={tryAnother} className={OUTLINED}>
              Try another
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <section
      aria-label="Soundtrack"
      className="rounded-2xl border border-[var(--av2-fill-lavender)]/50 bg-[var(--av2-lavender-bg)] p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="flex items-center gap-3 text-lg leading-7 font-semibold">
          <span className={INK}>
            <HeadphonesIcon />
          </span>
          {brand ? "The brand's soundtrack" : "Soundtrack for this request"}
        </h3>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide the soundtrack for this request"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl hover:bg-[var(--av2-surface)] focus-visible:ring-2 focus-visible:ring-[#4b3fb0] focus-visible:outline-none"
        >
          &times;
        </button>
      </div>

      {data.mood && (moods.length > 0 || data.canTurnOffSuggestions) ? (
        <div ref={menuRef} className="relative mt-1 inline-block">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuOpen((o) => !o)}
            className={`inline-flex min-h-8 items-center gap-2 rounded-lg bg-[#dcd4fb] px-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-[#4b3fb0] focus-visible:outline-none dark:bg-[#3a3166] ${INK}`}
          >
            <span className="sr-only">Mood: </span>
            {data.mood.label}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="m6 9 6 6 6-6"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {menuOpen ? (
            <div
              id={menuId}
              role="menu"
              aria-label="Mood"
              className="absolute top-full left-0 z-20 mt-1 w-60 rounded-xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-1.5 shadow-lg"
            >
              {moods.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={m.value === data.mood?.value}
                  onClick={() => {
                    setMenuOpen(false);
                    setPlaying((current) => (current === brand?.url ? current : null));
                    setMood(m.value);
                  }}
                  className={`flex min-h-10 w-full items-center justify-between rounded-lg px-3 text-left text-base hover:bg-[var(--av2-lavender-bg)] focus-visible:ring-2 focus-visible:ring-[#4b3fb0] focus-visible:outline-none ${
                    m.value === data.mood?.value ? `font-semibold ${INK}` : ""
                  }`}
                >
                  {m.label}
                  {m.value === data.mood?.value ? <span aria-hidden>✓</span> : null}
                </button>
              ))}
              {data.canTurnOffSuggestions ? (
                <>
                  {moods.length > 0 ? (
                    <div className="my-1.5 h-px bg-[var(--av2-border)]" aria-hidden />
                  ) : null}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={stopSuggestions}
                    className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-base text-[var(--av2-text-2)] hover:bg-[var(--av2-bg)] focus-visible:ring-2 focus-visible:ring-[#4b3fb0] focus-visible:outline-none"
                  >
                    Don&rsquo;t suggest music
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 space-y-4">
        {brand ? row(brand, "brand") : null}
        {brand && suggestion ? (
          <div className="h-px bg-[var(--av2-fill-lavender)]/40" aria-hidden />
        ) : null}
        {suggestion ? row(suggestion, "suggestion") : null}
        {!brand && !suggestion ? (
          <p className="text-base text-[var(--av2-text-2)]">
            No playlists for this mood yet. Pick another mood above.
          </p>
        ) : null}
      </div>
    </section>
  );
}
