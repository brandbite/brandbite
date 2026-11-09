// -----------------------------------------------------------------------------
// @file: lib/sizes/types.ts
// @purpose: Shapes for the social media and ad size guide (/sizes).
// -----------------------------------------------------------------------------

/**
 * Where platform UI covers the image, in pixels of the full-size canvas.
 * Edges cover strips from that side; `centre` is a box that stays visible
 * everywhere (YouTube banners).
 */
export type SafeZone =
  | { kind: "edges"; top?: number; bottom?: number; left?: number; right?: number; note: string }
  | { kind: "centre"; width: number; height: number; note: string };

export type SizeFormat = {
  /** Stable id, unique within the platform; used for anchors. */
  id: string;
  name: string;
  width: number;
  height: number;
  /** Aspect ratio as platforms write it, e.g. "4:5". */
  ratio: string;
  /** Short line on where the format shows up. */
  use: string;
  minimum?: string;
  fileTypes?: string;
  maxFileSize?: string;
  safeZone?: SafeZone;
  notes?: string;
  /** False when only third-party sources give the number. */
  verified: boolean;
  /** Listed in the hub's "most used sizes" table. */
  popular?: boolean;
};

export type SizeSource = { label: string; url: string };

export type SizePlatform = {
  slug: string;
  name: string;
  /** H1 text before the orange "sizes.", e.g. "Instagram image". */
  headline: string;
  /** Search title, about 50 characters; " | brandbite" is added after it. */
  seoTitle: string;
  /** Meta description and intro line. */
  description: string;
  /** A few lines of practical advice, unique to the platform. */
  tips: string[];
  formats: SizeFormat[];
  sources: SizeSource[];
  /** ISO date the numbers were last checked against the sources. */
  checkedOn: string;
  /** Ad platforms are grouped separately on the hub. */
  group: "social" | "ads";
};
