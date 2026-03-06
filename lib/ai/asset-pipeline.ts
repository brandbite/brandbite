// -----------------------------------------------------------------------------
// @file: lib/ai/asset-pipeline.ts
// @purpose: Save AI-generated images to R2 and register as Assets
// -----------------------------------------------------------------------------

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createR2Client, getR2BucketName, resolveAssetUrl } from "../r2";
import { prisma } from "../prisma";
import { randomBytes } from "crypto";

// ---------------------------------------------------------------------------
// Download image from provider URL and upload to R2
// ---------------------------------------------------------------------------

export async function saveAiImageToR2(options: {
  imageUrl: string;
  ticketId: string;
  revisionId: string;
  userId: string;
  originalName?: string;
}): Promise<{
  assetId: string;
  storageKey: string;
  url: string | null;
}> {
  const { imageUrl, ticketId, revisionId, userId } = options;

  // 1. Download the image from the provider URL
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download AI image: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") || "image/png";
  const ext = contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : "png";
  const rand = randomBytes(4).toString("hex");
  const safeName = options.originalName || `ai-generated-${rand}.${ext}`;

  // 2. Upload to R2
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

  // 3. Resolve the public URL
  const url = await resolveAssetUrl(storageKey, null);

  // 4. Register the Asset in the database
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
