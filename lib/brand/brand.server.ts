// -----------------------------------------------------------------------------
// @file: lib/brand/brand.server.ts
// @purpose: Server side of the brand guide: find (or start) a company's
//           default brand, and shape a brand and its files for the page.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-11-15
// -----------------------------------------------------------------------------

import "server-only";

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Brand, BrandAsset } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { createR2Client, getR2BucketName } from "@/lib/r2";

import { readBrandColors, readBrandFonts } from "./brand-data";
import { brandFileContentType, isBrandFilePreviewable } from "./brand-files";

const PREVIEW_URL_SECONDS = 20 * 60;

/** The company's default brand. Started on first use, named after the company. */
export async function getOrCreateDefaultBrand(companyId: string): Promise<Brand> {
  const existing = await prisma.brand.findFirst({ where: { companyId, isDefault: true } });
  if (existing) return existing;

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { name: true },
  });

  try {
    return await prisma.brand.create({
      data: { companyId, name: company.name.slice(0, 80), isDefault: true },
    });
  } catch (error) {
    // Two requests started it at once: the unique index let one through.
    if ((error as { code?: string })?.code === "P2002") {
      return prisma.brand.findFirstOrThrow({ where: { companyId, isDefault: true } });
    }
    throw error;
  }
}

/** A link an <img> can load. Never a download link, and never for other types. */
async function previewUrl(asset: BrandAsset): Promise<string | null> {
  if (!isBrandFilePreviewable(asset.name)) return null;
  try {
    const cmd = new GetObjectCommand({
      Bucket: getR2BucketName(),
      Key: asset.r2Key,
      ResponseContentType: brandFileContentType(asset.name),
    });
    return await getSignedUrl(createR2Client(), cmd, { expiresIn: PREVIEW_URL_SECONDS });
  } catch {
    return null;
  }
}

export async function brandAssetView(asset: BrandAsset) {
  return {
    id: asset.id,
    kind: asset.kind,
    background: asset.background,
    label: asset.label,
    name: asset.name,
    sizeBytes: Number(asset.sizeBytes),
    previewUrl: await previewUrl(asset),
    createdAt: asset.createdAt.toISOString(),
  };
}

export type BrandAssetView = Awaited<ReturnType<typeof brandAssetView>>;

export function brandView(brand: Brand) {
  return {
    id: brand.id,
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
    updatedAt: brand.updatedAt.toISOString(),
  };
}

export type BrandView = ReturnType<typeof brandView>;

/** A brand's files that finished uploading, oldest first. */
export async function listBrandAssets(brandId: string): Promise<BrandAssetView[]> {
  const assets = await prisma.brandAsset.findMany({
    where: { brandId, status: "READY", deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  return Promise.all(assets.map(brandAssetView));
}

/**
 * The brand guide that applies to a request: the brand its project names,
 * else the company's default brand.
 */
export async function brandForProject(args: {
  companyId: string;
  projectId?: string | null;
}): Promise<{ brand: Brand }> {
  const project = args.projectId
    ? await prisma.project.findFirst({
        where: { id: args.projectId, companyId: args.companyId },
        select: { brand: true },
      })
    : null;
  const projectBrand = project?.brand?.companyId === args.companyId ? project.brand : null;
  return { brand: projectBrand ?? (await getOrCreateDefaultBrand(args.companyId)) };
}
