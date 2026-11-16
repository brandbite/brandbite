// -----------------------------------------------------------------------------
// @file: lib/ai/asset-pipeline.ts
// @purpose: Keep AI-generated images in R2: as a request's output Asset, or
//           under the company's own AI folder for the standalone tools.
// -----------------------------------------------------------------------------

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createR2Client, getR2BucketName, resolveAssetUrl } from "../r2";
import { prisma } from "../prisma";
import { randomBytes } from "crypto";

function extensionFor(contentType: string): string {
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  return "png";
}

// ---------------------------------------------------------------------------
// A standalone tool's image (AI Tools page), kept under the company's folder
// ---------------------------------------------------------------------------

export async function saveAiGenerationImage(options: {
  bytes: Buffer;
  contentType: string;
  companyId: string;
  generationId: string;
}): Promise<{ storageKey: string; url: string | null }> {
  const { bytes, contentType, companyId, generationId } = options;
  const storageKey = `ai/${companyId}/${generationId}.${extensionFor(contentType)}`;

  await createR2Client().send(
    new PutObjectCommand({
      Bucket: getR2BucketName(),
      Key: storageKey,
      Body: bytes,
      ContentType: contentType,
    }),
  );

  return { storageKey, url: await resolveAssetUrl(storageKey, null) };
}

/**
 * Copies a provider's result (Replicate hands out a link that expires) into
 * our storage, so the customer's result doesn't disappear.
 */
export async function storeAiGenerationImageFromUrl(options: {
  url: string;
  companyId: string;
  generationId: string;
}): Promise<{ storageKey: string; url: string | null }> {
  const response = await fetch(options.url);
  if (!response.ok) throw new Error(`Failed to download the AI result: ${response.status}`);
  return saveAiGenerationImage({
    bytes: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "image/png",
    companyId: options.companyId,
    generationId: options.generationId,
  });
}

/**
 * A link to a generation's image that works now. Images we stored get a fresh
 * link every time (a saved one may have expired); older rows keep what they have.
 */
export async function aiGenerationImageUrl(generation: {
  outputImageUrl: string | null;
  outputParams: unknown;
}): Promise<string | null> {
  const storageKey = (generation.outputParams as { storageKey?: unknown } | null)?.storageKey;
  if (typeof storageKey === "string" && storageKey) {
    return (await resolveAssetUrl(storageKey, null)) ?? generation.outputImageUrl;
  }
  return generation.outputImageUrl;
}

// ---------------------------------------------------------------------------
// A request's AI output: upload to R2 and register the Asset
// ---------------------------------------------------------------------------

export async function saveAiImageToR2(options: {
  bytes: Buffer;
  contentType: string;
  ticketId: string;
  revisionId: string;
  userId: string;
  originalName?: string;
}): Promise<{
  assetId: string;
  storageKey: string;
  url: string | null;
}> {
  const { bytes: buffer, contentType, ticketId, revisionId, userId } = options;

  const ext = extensionFor(contentType);
  const rand = randomBytes(4).toString("hex");
  const safeName = options.originalName || `ai-generated-${rand}.${ext}`;

  // 1. Upload to R2
  const storageKey = `tickets/${ticketId}/outputs/${Date.now()}_${rand}_${safeName}`;
  const r2 = createR2Client();
  const bucket = getR2BucketName();

  await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  // 2. Resolve the link
  const url = await resolveAssetUrl(storageKey, null);

  // 3. Register the Asset in the database
  const asset = await prisma.asset.create({
    data: {
      ticketId,
      revisionId,
      kind: "OUTPUT_IMAGE",
      storageKey,
      url,
      mimeType: contentType,
      bytes: buffer.length,
      originalName: safeName,
      createdById: userId,
    },
  });

  return {
    assetId: asset.id,
    storageKey,
    url,
  };
}
