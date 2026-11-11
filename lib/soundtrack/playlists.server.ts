// -----------------------------------------------------------------------------
// @file: lib/soundtrack/playlists.server.ts
// @purpose: Server side of soundtracks: the owner's playlist links per mood
//           (AppSettings, edited in /admin/settings → Engagement) and each
//           playlist's name and cover from Spotify's public oEmbed endpoint
//           (no key, no sign-in). oEmbed answers are cached for a day; if it
//           can't be reached the playlist still plays, just without a cover.
// -----------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";

import { MOODS, moodSettingKey, type Mood } from "./moods";
import { parseSpotifyList, parseSpotifyUrl, spotifyEmbedUrl, spotifyOpenUrl } from "./spotify";

export type PlaylistInfo = {
  /** Clean open.spotify.com link. */
  url: string;
  embedUrl: string;
  title: string;
  coverUrl: string | null;
};

/** Name and cover for one playlist or album link; null when the link isn't one. */
export async function getPlaylistInfo(url: string): Promise<PlaylistInfo | null> {
  const ref = parseSpotifyUrl(url);
  if (!ref) return null;
  const openUrl = spotifyOpenUrl(ref);
  const info: PlaylistInfo = {
    url: openUrl,
    embedUrl: spotifyEmbedUrl(ref),
    title: ref.kind === "album" ? "Album on Spotify" : "Playlist on Spotify",
    coverUrl: null,
  };
  try {
    const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(openUrl)}`, {
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(4_000),
    });
    if (res.ok) {
      const json = (await res.json()) as { title?: unknown; thumbnail_url?: unknown };
      if (typeof json.title === "string" && json.title.trim()) info.title = json.title.trim();
      if (typeof json.thumbnail_url === "string" && json.thumbnail_url.startsWith("https://")) {
        info.coverUrl = json.thumbnail_url;
      }
    }
  } catch {
    // Spotify unreachable: keep the generic title.
  }
  return info;
}

/** The owner's playlist links for every mood, in one query. */
export async function getMoodPlaylistLinks(): Promise<Record<Mood, string[]>> {
  const out = Object.fromEntries(MOODS.map((m) => [m, [] as string[]])) as Record<Mood, string[]>;
  try {
    const rows = await prisma.appSetting.findMany({
      where: { key: { in: MOODS.map(moodSettingKey) } },
      select: { key: true, value: true },
    });
    for (const mood of MOODS) {
      out[mood] = parseSpotifyList(rows.find((r) => r.key === moodSettingKey(mood))?.value);
    }
  } catch (err) {
    console.error("[soundtrack] playlist settings read failed", err);
  }
  return out;
}
