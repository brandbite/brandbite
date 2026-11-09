// -----------------------------------------------------------------------------
// @file: app/api/customer/ticket-drafts/[draftId]/attachments/route.ts
// @purpose: Adds a brief file to the signed-in person's own draft. Same limits as
//           a request's brief. The file becomes a brief attachment on submit.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createR2Client, getR2BucketName, getR2PublicBaseUrl } from "@/lib/r2";
import { DRAFT_ATTACHMENT_SELECT, MAX_DRAFT_ATTACHMENTS } from "@/lib/ticket-drafts";
import { isBriefMimeAllowed, MAX_UPLOAD_BYTES } from "@/lib/upload-helpers";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ draftId: string }> };

function storageKeyFor(draftId: string, name: string | null) {
  const safeName = (name ?? "file")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
  return `ticket-drafts/${draftId}/${Date.now()}_${crypto.randomUUID().slice(0, 12)}_${safeName}`;
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUserOrThrow();
    const { draftId } = await params;

    if (user.role !== "CUSTOMER" || !user.activeCompanyId) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    const draft = await prisma.ticketDraft.findFirst({
      where: { id: draftId, createdById: user.id, companyId: user.activeCompanyId },
      select: { id: true, _count: { select: { attachments: true } } },
    });
    if (!draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }
    if (draft._count.attachments >= MAX_DRAFT_ATTACHMENTS) {
      return NextResponse.json(
        { error: "TOO_MANY_FILES", message: `A request can have ${MAX_DRAFT_ATTACHMENTS} files.` },
        { status: 400 },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "FILE_TOO_LARGE", maxBytes: MAX_UPLOAD_BYTES },
        { status: 413 },
      );
    }
    const mime = file.type || "";
    if (!isBriefMimeAllowed(mime)) {
      return NextResponse.json(
        {
          error: "UNSUPPORTED_TYPE",
          message: `Files of type "${mime || "unknown"}" aren't accepted on briefs. Use an image, PDF, DOC, DOCX, or TXT.`,
        },
        { status: 415 },
      );
    }

    const originalName = file.name || null;
    const storageKey = storageKeyFor(draft.id, originalName);

    await createR2Client().send(
      new PutObjectCommand({
        Bucket: getR2BucketName(),
        Key: storageKey,
        Body: Buffer.from(await file.arrayBuffer()),
        ContentType: mime,
      }),
    );

    const publicBase = getR2PublicBaseUrl();
    const attachment = await prisma.ticketDraftAttachment.create({
      data: {
        draftId: draft.id,
        storageKey,
        url: publicBase ? `${publicBase.replace(/\/$/, "")}/${storageKey}` : null,
        mimeType: mime,
        bytes: file.size,
        width: parseInt(String(formData.get("width") ?? ""), 10) || null,
        height: parseInt(String(formData.get("height") ?? ""), 10) || null,
        originalName,
      },
      select: DRAFT_ATTACHMENT_SELECT,
    });

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[customer.ticket-drafts] attachment POST error", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
