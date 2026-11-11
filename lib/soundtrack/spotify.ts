// -----------------------------------------------------------------------------
// @file: lib/soundtrack/spotify.ts
// @purpose: Spotify links, embeds only. We never call the Spotify Web API or
//           ask anyone to sign in: a playlist or album link becomes Spotify's
//           own embedded player, which needs no approval or quota.
//           No server imports, so client components can share it.
// -----------------------------------------------------------------------------

export type SpotifyKind = "playlist" | "album";

export type SpotifyRef = { kind: SpotifyKind; id: string };

/** A playlist or album link (open.spotify.com/…, with or without a locale prefix), or null. */
export function parseSpotifyUrl(input: string | null | undefined): SpotifyRef | null {
  if (!input) return null;
  try {
    const u = new URL(input.trim());
    if (u.protocol !== "https:" || u.hostname !== "open.spotify.com") return null;
    // /playlist/ID, /intl-tr/playlist/ID, /embed/playlist/ID
    const m = u.pathname.match(
      /^\/(?:intl-[a-z-]+\/|embed\/)?(playlist|album)\/([A-Za-z0-9]{10,40})\/?$/,
    );
    return m ? { kind: m[1] as SpotifyKind, id: m[2]! } : null;
  } catch {
    return null;
  }
}

/** The clean link we store and open. */
export function spotifyOpenUrl(ref: SpotifyRef): string {
  return `https://open.spotify.com/${ref.kind}/${ref.id}`;
}

/** Spotify's embedded player for it. */
export function spotifyEmbedUrl(ref: SpotifyRef): string {
  return `https://open.spotify.com/embed/${ref.kind}/${ref.id}`;
}

/** Split a setting value ("link, link" or one per line) into valid, unique links. */
export function parseSpotifyList(value: string | null | undefined): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  for (const part of value.split(/[\s,]+/)) {
    const ref = parseSpotifyUrl(part);
    if (ref) seen.add(spotifyOpenUrl(ref));
  }
  return [...seen];
}

/** The entries of a setting value that aren't Spotify playlist or album links. */
export function invalidSpotifyEntries(value: string): string[] {
  return value.split(/[\s,]+/).filter((part) => part.length > 0 && !parseSpotifyUrl(part));
}
