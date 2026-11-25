// -----------------------------------------------------------------------------
// @file: lib/post-preview/placements.ts
// @purpose: Where a visual can be previewed: feed posts and full-screen
//           stories. Sizes and safe zones come from the size guide
//           (lib/sizes), so the preview and the guide agree. Pure.
// -----------------------------------------------------------------------------

import { getSizePlatform } from "@/lib/sizes";
import type { SafeZone } from "@/lib/sizes/types";

export type PlacementKind = "feed" | "story";

export type Placement = {
  id: string;
  label: string;
  platform: string;
  kind: PlacementKind;
  /** How feeds of this kind lay a post out: picture first, or text first. */
  style: "photo" | "text";
  width: number;
  height: number;
  safeZone: SafeZone | null;
};

/** platform slug, format id in the size guide, and how it is shown. */
const SOURCES: [string, string, PlacementKind, string][] = [
  ["instagram", "square-post", "feed", "Instagram · Square post"],
  ["instagram", "portrait-post", "feed", "Instagram · Portrait post"],
  ["instagram", "story", "story", "Instagram · Story"],
  ["facebook", "landscape-post", "feed", "Facebook · Landscape post"],
  ["linkedin", "landscape-post", "feed", "LinkedIn · Landscape post"],
  ["linkedin", "square-post", "feed", "LinkedIn · Square post"],
  ["x", "landscape-post", "feed", "X · Landscape post"],
  ["tiktok", "video", "story", "TikTok · Full screen"],
];

/** Every placement whose size is in the size guide; one that has been removed there is skipped. */
export function placements(): Placement[] {
  return SOURCES.flatMap(([slug, formatId, kind, label]) => {
    const platform = getSizePlatform(slug);
    const format = platform?.formats.find((f) => f.id === formatId);
    if (!platform || !format) return [];
    return [
      {
        id: `${slug}:${formatId}`,
        label,
        platform: platform.name,
        kind,
        style: slug === "instagram" || kind === "story" ? "photo" : "text",
        width: format.width,
        height: format.height,
        safeZone: format.safeZone ?? null,
      },
    ];
  });
}

/**
 * The parts of a placement that the app's own buttons and labels cover, as
 * percentages of the picture, for drawing over a preview. Null without a
 * safe zone given as covered edges.
 */
export function coveredEdges(
  placement: Pick<Placement, "width" | "height" | "safeZone">,
): { top: number; bottom: number; left: number; right: number; note: string } | null {
  const zone = placement.safeZone;
  if (!zone || zone.kind !== "edges") return null;
  const percent = (pixels: number | undefined, of: number) => ((pixels ?? 0) / of) * 100;
  return {
    top: percent(zone.top, placement.height),
    bottom: percent(zone.bottom, placement.height),
    left: percent(zone.left, placement.width),
    right: percent(zone.right, placement.width),
    note: zone.note,
  };
}

/** How well an image's shape suits a placement: "fits", or what will be cut. */
export function fitNote(
  imageWidth: number,
  imageHeight: number,
  placement: Pick<Placement, "width" | "height">,
): string {
  const image = imageWidth / imageHeight;
  const wanted = placement.width / placement.height;
  if (Math.abs(Math.log(image / wanted)) < 0.03) return "Your image has this placement's shape.";
  const lost = image > wanted ? 1 - wanted / image : 1 - image / wanted;
  const where = image > wanted ? "left and right" : "top and bottom";
  return `Your image has a different shape: about ${Math.round(lost * 100)}% is cut from the ${where}.`;
}
