// -----------------------------------------------------------------------------
// @file: lib/colors/content.ts
// @purpose: Server reads of Color Studio content, so it can be in a page's first
//           HTML instead of loading in the browser. CMS entries come first and
//           built-in content fills the gaps. If the CMS can't be reached, these
//           return the built-in content rather than failing the page.
// -----------------------------------------------------------------------------

import { cache } from "react";

import { prisma } from "@/lib/prisma";

import { COLOR_FAMILIES } from "./color-families";
import { BUILT_IN_MEANING_PREFIX, type MeaningDetail, type MeaningSummary } from "./meaning-types";
import { PALETTE_IDEA_CATALOG, type PaletteIdeaEntry } from "./palette-idea-catalog";

export type PaletteIdea = Omit<PaletteIdeaEntry, "summary"> & { summary: string | null };

const builtInMeanings = (): MeaningSummary[] =>
  COLOR_FAMILIES.map((family) => ({ ...family, id: `${BUILT_IN_MEANING_PREFIX}${family.slug}` }));

/** All palette ideas: CMS first, then the catalog without repeating a slug. */
export const getPaletteIdeas = cache(async (): Promise<PaletteIdea[]> => {
  let cms: PaletteIdea[] = [];
  try {
    const rows = await prisma.paletteIdea.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: { id: true, title: true, slug: true, summary: true, colors: true, tags: true },
    });
    cms = rows.map((row) => ({
      ...row,
      colors: Array.isArray(row.colors) ? (row.colors as string[]) : [],
    }));
  } catch (err) {
    console.error("[colors/content] palette ideas error", err);
  }
  const cmsSlugs = new Set(cms.map((idea) => idea.slug));
  return [...cms, ...PALETTE_IDEA_CATALOG.filter((idea) => !cmsSlugs.has(idea.slug))];
});

export async function getPaletteIdea(slug: string): Promise<PaletteIdea | null> {
  return (await getPaletteIdeas()).find((idea) => idea.slug === slug) ?? null;
}

/** All color families: CMS first, then built-in families without repeating a slug. */
export async function getColorMeanings(): Promise<MeaningSummary[]> {
  let cms: MeaningSummary[] = [];
  try {
    cms = await prisma.colorMeaning.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: { id: true, name: true, slug: true, hex: true, summary: true, associations: true },
    });
  } catch (err) {
    console.error("[colors/content] color meanings error", err);
  }
  const cmsSlugs = new Set(cms.map((meaning) => meaning.slug));
  return [...cms, ...builtInMeanings().filter((meaning) => !cmsSlugs.has(meaning.slug))];
}

export const getColorMeaning = cache(async (slug: string): Promise<MeaningDetail | null> => {
  try {
    const row = await prisma.colorMeaning.findFirst({ where: { slug, status: "PUBLISHED" } });
    if (row) {
      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        hex: row.hex,
        summary: row.summary,
        associations: row.associations,
        meaning: row.meaning,
        samplePalettes: Array.isArray(row.samplePalettes) ? (row.samplePalettes as string[][]) : [],
        metaTitle: row.metaTitle,
        metaDescription: row.metaDescription,
      };
    }
  } catch (err) {
    console.error("[colors/content] color meaning error", err);
  }
  const builtIn = builtInMeanings().find((meaning) => meaning.slug === slug);
  return builtIn ? { ...builtIn, meaning: null, samplePalettes: [] } : null;
});
