// -----------------------------------------------------------------------------
// @file: lib/support/features.ts
// @purpose: Hides guide text about features the site owner has switched off.
//           Guides, sections and blocks can be marked with a feature
//           (types.ts, GuideFeature); the text is written ahead of time and
//           shows by itself the moment the switch goes on. Pure, so it is
//           tested without a database.
// -----------------------------------------------------------------------------

import type { EngagementSwitches } from "@/lib/engagement/switches";

import type { MergedGuides } from "./merge";
import type { GuideFeature, SupportGuide } from "./types";

/** Every feature a guide depends on: the guide itself, a section or a block. */
export function guideFeatures(guide: SupportGuide): GuideFeature[] {
  const found = new Set<GuideFeature>();
  if (guide.feature) found.add(guide.feature);
  for (const section of guide.sections) {
    if (section.feature) found.add(section.feature);
    for (const block of section.blocks) if (block.feature) found.add(block.feature);
  }
  return [...found];
}

/**
 * The guides as people should see them with these switches. A guide about a
 * switched-off feature is treated like a hidden one (its address sends people
 * to the Support home), and so is a guide left with no text at all.
 */
export function applyFeatureSwitches(
  merged: MergedGuides,
  switches: EngagementSwitches,
): MergedGuides {
  const on = (feature: GuideFeature | undefined) => !feature || switches[feature];
  const guides: SupportGuide[] = [];
  const hiddenSlugs = [...merged.hiddenSlugs];

  for (const guide of merged.guides) {
    if (guideFeatures(guide).length === 0) {
      guides.push(guide);
      continue;
    }
    const sections = on(guide.feature)
      ? guide.sections
          .filter((section) => on(section.feature))
          .map((section) => ({
            ...section,
            blocks: section.blocks.filter((block) => on(block.feature)),
          }))
          .filter((section) => section.blocks.length > 0)
      : [];
    if (sections.length === 0) hiddenSlugs.push(guide.slug);
    else guides.push({ ...guide, sections });
  }

  return { guides, hiddenSlugs };
}
