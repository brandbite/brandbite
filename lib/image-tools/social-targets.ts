// -----------------------------------------------------------------------------
// @file: lib/image-tools/social-targets.ts
// @purpose: The sizes the social resizer offers, taken from the size guide's
//           checked numbers (lib/sizes), so the two never disagree.
// -----------------------------------------------------------------------------

import { SIZE_PLATFORMS } from "@/lib/sizes";

import { slugify } from "./fit";

export type SocialTarget = {
  /** Unique across platforms: "instagram:square-post". */
  key: string;
  platform: string;
  platformSlug: string;
  name: string;
  width: number;
  height: number;
  ratio: string;
  popular: boolean;
};

export type SocialPlatform = { slug: string; name: string; targets: SocialTarget[] };

/** Social platforms with their image sizes; ad platforms are left to the size guide. */
export function socialPlatforms(): SocialPlatform[] {
  return SIZE_PLATFORMS.filter((platform) => platform.group === "social").map((platform) => ({
    slug: platform.slug,
    name: platform.name,
    targets: platform.formats.map((format) => ({
      key: `${platform.slug}:${format.id}`,
      platform: platform.name,
      platformSlug: platform.slug,
      name: format.name,
      width: format.width,
      height: format.height,
      ratio: format.ratio,
      popular: Boolean(format.popular),
    })),
  }));
}

/** What is ticked when a platform is switched on: its most used sizes, or its first if none is marked. */
export function defaultTargetKeys(platform: SocialPlatform): string[] {
  const popular = platform.targets.filter((target) => target.popular);
  return (popular.length > 0 ? popular : platform.targets.slice(0, 1)).map((target) => target.key);
}

/** "instagram-square-post-1080x1080.jpg" */
export function socialFileName(target: SocialTarget, extension: string): string {
  return `${target.platformSlug}-${slugify(target.name)}-${target.width}x${target.height}.${extension}`;
}
