// -----------------------------------------------------------------------------
// @file: lib/soundtrack/combos.ts
// @purpose: brandbite's own playlists: one for every mix of one, two or three
//           moods (41 in all), made once on brandbite's Spotify account by
//           scripts/spotify/generate-playlists.mjs and kept as plain links in
//           generated-playlists.json. Nothing here talks to Spotify; the app
//           only embeds the links. No server imports, so client components
//           can share it.
// -----------------------------------------------------------------------------

import generated from "./generated-playlists.json";
import { MOOD_LABELS, MOODS, type Mood } from "./moods";
import { parseSpotifyUrl, spotifyEmbedUrl, spotifyOpenUrl } from "./spotify";

/** "MINIMAL+BOLD": the moods without repeats, in MOODS order. */
export function comboKey(moods: readonly Mood[]): string {
  return MOODS.filter((m) => moods.includes(m)).join("+");
}

/** "Minimal" for one mood, "Minimal + Bold" for a mix (in the order given). */
export function comboLabel(moods: readonly Mood[]): string {
  const unique = moods.filter((m, i) => moods.indexOf(m) === i);
  return unique.map((m) => MOOD_LABELS[m].split(" · ")[0]).join(" + ");
}

export type GeneratedPlaylist = {
  url: string;
  embedUrl: string;
  title: string;
  coverUrl: null;
};

/** Every generated playlist by comboKey; empty until the generator has run. */
export function generatedPlaylists(): Record<string, GeneratedPlaylist> {
  const out: Record<string, GeneratedPlaylist> = {};
  for (const [key, link] of Object.entries(generated as Record<string, string>)) {
    const ref = parseSpotifyUrl(link);
    const moods = key.split("+").filter((m): m is Mood => (MOODS as readonly string[]).includes(m));
    if (!ref || moods.length === 0 || comboKey(moods) !== key) continue;
    out[key] = {
      url: spotifyOpenUrl(ref),
      embedUrl: spotifyEmbedUrl(ref),
      title: `brandbite · ${moods.map((m) => MOOD_LABELS[m].split(" · ")[0]).join(" + ")}`,
      coverUrl: null,
    };
  }
  return out;
}
