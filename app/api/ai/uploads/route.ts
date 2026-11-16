// -----------------------------------------------------------------------------
// @file: app/api/ai/uploads/route.ts
// @purpose: Start the upload of an image a customer wants an AI tool to work
//           on. Answers with a link the browser PUTs the file to (straight to
//           storage), the key to hand to the tool, and a link to preview it.
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse, type NextRequest } from "next/server";

import { aiInputImageProblem, aiInputKey } from "@/lib/ai/input-images";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { createR2Client, getR2BucketName, resolveAssetUrl } from "@/lib/r2";

const UPLOAD_LINK_SECONDS = 5 * 60;

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    if (user.role !== "CUSTOMER" || !user.activeCompanyId) {
      return NextResponse.json({ error: "No active company" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as {
      contentType?: unknown;
      sizeBytes?: unknown;
    } | null;
    const contentType = typeof body?.contentType === "string" ? body.contentType : "";
    const sizeBytes = typeof body?.sizeBytes === "number" ? body.sizeBytes : 0;

    const problem = aiInputImageProblem({ type: contentType, size: sizeBytes });
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    const storageKey = aiInputKey(user.activeCompanyId, crypto.randomUUID(), contentType);
    const uploadUrl = await getSignedUrl(
      createR2Client(),
      new PutObjectCommand({
        Bucket: getR2BucketName(),
        Key: storageKey,
        ContentType: contentType,
      }),
      { expiresIn: UPLOAD_LINK_SECONDS },
    );

    return NextResponse.json({
      uploadUrl,
      storageKey,
      contentType,
      previewUrl: await resolveAssetUrl(storageKey, null),
    });
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    if (code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if (code === "MISSING_ENV") {
      return NextResponse.json({ error: "File uploads aren't set up." }, { status: 503 });
    }
    console.error("[api/ai/uploads] POST error", error);
    return NextResponse.json({ error: "Could not start the upload." }, { status: 500 });
  }
}
