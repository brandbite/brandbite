// -----------------------------------------------------------------------------
// @file: app/brand-playlist/page.tsx
// @purpose: Free public tool: "Brand playlist generator". Pick words that
//           describe a brand, get the mix of moods they add up to and the
//           playlist made for that mix (lib/soundtrack/combos.ts). The site
//           owner's own lists per mood (/admin/settings → Engagement) are
//           offered as extra picks. The page 404s while the owner's switch
//           ENGAGEMENT_PLAYLIST_TOOL is off or there are no playlists at all.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StudioShell } from "@/components/colors/studio/studio-shell";
import { JsonLd } from "@/components/seo/json-ld";
import {
  BrandPlaylistTool,
  type ToolMood,
  type ToolPlaylist,
} from "@/components/soundtrack/brand-playlist-tool";
import { isEngagementOn } from "@/lib/engagement/switches.server";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, webApplicationJsonLd } from "@/lib/seo/structured-data";
import { generatedPlaylists } from "@/lib/soundtrack/combos";
import { MOOD_LABELS, MOODS, type Mood } from "@/lib/soundtrack/moods";
import { getMoodPlaylistLinks, getPlaylistInfo } from "@/lib/soundtrack/playlists.server";

// Reads the owner's switch and playlists, so it can't be prebuilt.
export const dynamic = "force-dynamic";

const TOOL = {
  name: "Brand Playlist Generator",
  path: "/brand-playlist",
  description:
    "Pick the words that describe your brand and get a playlist that sounds like it. A quick way to set the mood for a creative brief.",
};

export const metadata: Metadata = pageMetadata({
  title: "Brand Playlist Generator",
  description: TOOL.description,
  path: TOOL.path,
});

/**
 * The words a visitor picks from: one per mood, so every pick changes the
 * playlist (two words for the same mood would give the same one).
 */
const WORDS: Record<Mood, string[]> = {
  ENERGETIC: ["Energetic"],
  MINIMAL: ["Minimal"],
  LUXURY: ["Luxurious"],
  PLAYFUL: ["Playful"],
  WARM: ["Warm"],
  BOLD: ["Bold"],
};

export default async function BrandPlaylistPage() {
  if (!(await isEngagementOn("playlistTool"))) notFound();

  const links = await getMoodPlaylistLinks();
  const combos = generatedPlaylists();
  const moods: ToolMood[] = [];
  for (const mood of MOODS) {
    const infos = (await Promise.all(links[mood].map(getPlaylistInfo))).filter((p) => p !== null);
    // A mood can be picked when it has its own playlist or the owner filled one in.
    if (infos.length === 0 && !combos[mood]) continue;
    moods.push({
      value: mood,
      label: MOOD_LABELS[mood],
      words: WORDS[mood],
      playlists: infos.map((p) => ({ url: p.url, embedUrl: p.embedUrl, title: p.title })),
    });
  }
  if (moods.length === 0) notFound();
  const mixes: Record<string, ToolPlaylist> = Object.fromEntries(
    Object.entries(combos).map(([key, p]) => [
      key,
      { url: p.url, embedUrl: p.embedUrl, title: p.title },
    ]),
  );

  return (
    <StudioShell
      label="BRAND PLAYLIST"
      nav={null}
      title="What does your brand"
      accent="sound like?"
      blurb="Pick the words that fit your brand. Get a playlist to match."
      ctaHeading="Set the mood."
      ctaHeadingAccent="We'll design to it."
      ctaBlurb="Add a soundtrack to your brand on brandbite and your creative hears it while they work."
    >
      <JsonLd
        data={[
          webApplicationJsonLd({ ...TOOL, category: "DesignApplication" }),
          breadcrumbJsonLd([{ name: TOOL.name, path: TOOL.path }]),
        ]}
      />

      <BrandPlaylistTool moods={moods} mixes={mixes} />

      <section
        aria-labelledby="bp-why"
        className="mt-6 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-8 max-[767px]:p-5"
      >
        <h2 id="bp-why" className="text-2xl leading-8 font-semibold">
          Why give a brand a soundtrack?
        </h2>
        <div className="mt-3 max-w-3xl space-y-3 text-base leading-7 text-[var(--cs-muted)]">
          <p>
            Words like &ldquo;modern&rdquo; or &ldquo;premium&rdquo; mean different things to
            different people. Music is harder to misread: a playlist tells a designer in thirty
            seconds how fast, how loud and how polished a brand should feel.
          </p>
          <p>
            Share the playlist with whoever designs for you, next to your colors and references. It
            works well at the top of a creative brief or on a moodboard.
          </p>
        </div>
      </section>
    </StudioShell>
  );
}
