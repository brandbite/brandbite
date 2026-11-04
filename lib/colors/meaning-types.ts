// -----------------------------------------------------------------------------
// @file: lib/colors/meaning-types.ts
// @purpose: Color meaning shapes shared by server pages and client views. Kept apart
//           from content.ts, which reads the database and must stay server-only.
// -----------------------------------------------------------------------------

export type MeaningSummary = {
  id: string;
  name: string;
  slug: string;
  hex: string;
  summary: string | null;
  associations: string[];
};

export type MeaningDetail = MeaningSummary & {
  meaning: string | null;
  samplePalettes: string[][];
  metaTitle?: string | null;
  metaDescription?: string | null;
};

export const BUILT_IN_MEANING_PREFIX = "family-";

export function isBuiltInMeaning(meaning: Pick<MeaningSummary, "id">): boolean {
  return meaning.id.startsWith(BUILT_IN_MEANING_PREFIX);
}
