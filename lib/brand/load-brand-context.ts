// -----------------------------------------------------------------------------
// @file: lib/brand/load-brand-context.ts
// @purpose: Load the brand guide that applies to a company's project, ready
//           for buildBrandContext. Server only.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

import "server-only";

import { prisma } from "@/lib/prisma";

import {
  buildBrandContext,
  type BrandContextPurpose,
  type BrandContextSource,
} from "./brand-context";
import { readBrandColors, readBrandFonts } from "./brand-data";

const BRAND_SELECT = {
  name: true,
  tagline: true,
  description: true,
  audience: true,
  values: true,
  references: true,
  toneWords: true,
  voiceNotes: true,
  voiceDo: true,
  voiceDont: true,
  wordsToUse: true,
  wordsToAvoid: true,
  sampleCopy: true,
  colors: true,
  fonts: true,
  imageryNotes: true,
} as const;

/**
 * The brand guide for a project: the brand the project names, else the
 * company's default brand. A project of another company is ignored. Null
 * when the company has no brand guide yet.
 */
export async function loadBrandContextSource(args: {
  companyId: string;
  projectId?: string | null;
}): Promise<BrandContextSource | null> {
  const { companyId, projectId } = args;

  const project = projectId
    ? await prisma.project.findFirst({
        where: { id: projectId, companyId },
        select: { brand: { select: { ...BRAND_SELECT, companyId: true } } },
      })
    : null;

  // A project's brand must belong to the same company.
  const projectBrand = project?.brand?.companyId === companyId ? project.brand : null;
  const brand =
    projectBrand ??
    (await prisma.brand.findFirst({
      where: { companyId, isDefault: true },
      select: BRAND_SELECT,
    }));

  if (!brand) return null;

  return {
    name: brand.name,
    tagline: brand.tagline,
    description: brand.description,
    audience: brand.audience,
    values: brand.values,
    references: brand.references,
    toneWords: brand.toneWords,
    voiceNotes: brand.voiceNotes,
    voiceDo: brand.voiceDo,
    voiceDont: brand.voiceDont,
    wordsToUse: brand.wordsToUse,
    wordsToAvoid: brand.wordsToAvoid,
    sampleCopy: brand.sampleCopy,
    colors: readBrandColors(brand.colors),
    fonts: readBrandFonts(brand.fonts),
    imageryNotes: brand.imageryNotes,
  };
}

/**
 * Brand context for a company's AI prompt, or null when the caller switched
 * it off (`useBrand: false`) or the guide has nothing for that purpose.
 */
export async function brandContextFor(
  companyId: string,
  purpose: BrandContextPurpose,
  options: { projectId?: string | null; useBrand?: unknown } = {},
): Promise<string | null> {
  if (options.useBrand === false) return null;
  return buildBrandContext(
    await loadBrandContextSource({ companyId, projectId: options.projectId }),
    purpose,
  );
}
