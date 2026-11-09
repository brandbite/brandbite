// -----------------------------------------------------------------------------
// @file: lib/support/effective.ts
// @purpose: The guides people actually see: code guides with the CMS layer
//           (GuideEntry rows) merged in. Server only. If the database can't
//           be reached, the code guides still show.
// -----------------------------------------------------------------------------

import "server-only";

import { cache } from "react";

import type { GuideAudience } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { AUDIENCE_FOR_OWNER, codeGuidesFor, type GuideOwner } from "./code-sources";
import { mergeGuides, type GuideEntryLike, type MergedGuides } from "./merge";
import type { SupportGuide } from "./types";

const loadEntries = cache(async (audience: GuideAudience): Promise<GuideEntryLike[]> => {
  try {
    return await prisma.guideEntry.findMany({
      where: { audience },
      select: { slug: true, fromCode: true, hidden: true, content: true, codeStatus: true },
    });
  } catch (err) {
    console.error("[support] guide entries error", err);
    return [];
  }
});

/** Code guides with the CMS layer applied, once per request. */
export const getEffectiveGuides = cache(async (role: GuideOwner): Promise<MergedGuides> => {
  const entries = await loadEntries(AUDIENCE_FOR_OWNER[role]);
  return mergeGuides(codeGuidesFor(role), entries);
});

export async function getEffectiveGuide(
  role: GuideOwner,
  slug: string,
): Promise<{ guide?: SupportGuide; hidden: boolean; all: SupportGuide[] }> {
  const { guides, hiddenSlugs } = await getEffectiveGuides(role);
  return {
    guide: guides.find((g) => g.slug === slug),
    hidden: hiddenSlugs.includes(slug),
    all: guides,
  };
}
