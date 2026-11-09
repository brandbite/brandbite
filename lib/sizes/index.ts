// -----------------------------------------------------------------------------
// @file: lib/sizes/index.ts
// @purpose: The size guide's platform list and lookups.
// -----------------------------------------------------------------------------

import { SIZE_PLATFORMS } from "./platforms";
import type { SizePlatform } from "./types";

export { SIZE_PLATFORMS };

export function getSizePlatform(slug: string): SizePlatform | null {
  return SIZE_PLATFORMS.find((platform) => platform.slug === slug) ?? null;
}

/** Platforms shown as pills; the rest sit under "More". */
const PRIMARY_SLUGS = ["instagram", "facebook", "linkedin", "tiktok", "youtube"];

export const SIZE_NAV = [
  { href: "/sizes", label: "All sizes" },
  ...SIZE_PLATFORMS.filter((platform) => PRIMARY_SLUGS.includes(platform.slug)).map((platform) => ({
    href: `/sizes/${platform.slug}`,
    label: platform.name,
  })),
];

export const SIZE_NAV_MORE = SIZE_PLATFORMS.filter(
  (platform) => !PRIMARY_SLUGS.includes(platform.slug),
).map((platform) => ({ href: `/sizes/${platform.slug}`, label: platform.name }));

/** Every format flagged as popular, in platform order, for the hub table. */
export function popularFormats() {
  return SIZE_PLATFORMS.flatMap((platform) =>
    platform.formats.filter((format) => format.popular).map((format) => ({ platform, format })),
  );
}
