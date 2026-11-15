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

import type { BrandContextSource } from "./brand-context";
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
 * company's default brand. The project's older brand fields ride along and
 * fill in what the guide leaves empty. A project of another company is
 * ignored. Null when there is neither a brand nor any project field.
 */
export async function loadBrandContextSource(args: {
  companyId: string;
  projectId?: string | null;
}): Promise<BrandContextSource | null> {
  const { companyId, projectId } = args;

  const project = projectId
    ? await prisma.project.findFirst({
        where: { id: projectId, companyId },
        select: {
          brandLogoUrl: true,
          brandColors: true,
          brandFonts: true,
          brandVoice: true,
          brand: { select: { ...BRAND_SELECT, companyId: true } },
        },
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

  const legacy = project
    ? {
        logoUrl: project.brandLogoUrl,
        colors: project.brandColors,
        fonts: project.brandFonts,
        voice: project.brandVoice,
      }
    : undefined;
  const hasLegacy = !!legacy && Object.values(legacy).some(Boolean);

  if (!brand && !hasLegacy) return null;

  return {
    name: brand?.name,
    tagline: brand?.tagline,
    description: brand?.description,
    audience: brand?.audience,
    values: brand?.values,
    references: brand?.references,
    toneWords: brand?.toneWords,
    voiceNotes: brand?.voiceNotes,
    voiceDo: brand?.voiceDo,
    voiceDont: brand?.voiceDont,
    wordsToUse: brand?.wordsToUse,
    wordsToAvoid: brand?.wordsToAvoid,
    sampleCopy: brand?.sampleCopy,
    colors: readBrandColors(brand?.colors),
    fonts: readBrandFonts(brand?.fonts),
    imageryNotes: brand?.imageryNotes,
    legacy: hasLegacy ? legacy : undefined,
  };
}
