// -----------------------------------------------------------------------------
// @file: app/api/uploads/r2/upload/route.ts
// @purpose: Server-side file upload proxy — receives file via FormData,
//           uploads to R2, registers asset in DB, returns asset record.
//           Bypasses browser CORS issues with direct R2 presigned PUT.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-02-22
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { AssetKind } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { createR2Client, getR2BucketName } from "@/lib/r2";
import { resolveAssetUrl } from "@/lib/r2";
import { isCompanyAdminRole } from "@/lib/permissions/companyRoles";

function sanitizeFilename(name: string): string {
  const base = name.trim().replace(/\s+/g, "_");
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

function makeStorageKey(args: {
  ticketId: string;
  kind: AssetKind;
  originalName?: string | null;
}): string {
  const safeName = args.originalName ? sanitizeFilename(args.originalName) : "file";
  const ts = Date.now();
  const rand = crypto.randomUUID().slice(0, 12);

  const folder = args.kind === "BRIEF_INPUT" ? "brief" : "outputs";
  return `tickets/${args.ticketId}/${folder}/${ts}_${rand}_${safeName}`;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export async function POST(req: Request) {
  try {
    const user = await getCurrentUserOrThrow();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const ticketId = formData.get("ticketId") as string | null;
    const kind = formData.get("kind") as AssetKind | null;
    const revisionId = (formData.get("revisionId") as string | null) ?? null;
    const widthStr = formData.get("width") as string | null;
    const heightStr = formData.get("height") as string | null;

    if (!file || !ticketId || !kind) {
      return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
    }

    if (kind !== "BRIEF_INPUT" && kind !== "OUTPUT_IMAGE") {
      return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "FILE_TOO_LARGE", maxBytes: MAX_FILE_SIZE },
        { status: 413 },
      );
    }

    // ----------------------------
    // Ticket lookup
    // ----------------------------

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        companyId: true,
        createdById: true,
        creativeId: true,
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    // ----------------------------
    // Authorization
    // ----------------------------

    if (kind === "BRIEF_INPUT") {
      if (user.role !== "CUSTOMER") {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      }

      const membership = await prisma.companyMember.findUnique({
        where: {
          companyId_userId: {
            companyId: ticket.companyId,
            userId: user.id,
          },
        },
        select: { roleInCompany: true },
      });

      if (!membership) {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      }

      if (ticket.createdById !== user.id && !isCompanyAdminRole(membership.roleInCompany)) {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      }
    }

    if (kind === "OUTPUT_IMAGE") {
      if (user.role !== "DESIGNER") {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      }
      if (!ticket.creativeId || ticket.creativeId !== user.id) {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      }
      if (!revisionId) {
        return NextResponse.json({ error: "REVISION_REQUIRED" }, { status: 400 });
      }

      const rev = await prisma.ticketRevision.findFirst({
        where: { id: revisionId, ticketId },
        select: { id: true },
      });

      if (!rev) {
        return NextResponse.json({ error: "REVISION_NOT_FOUND" }, { status: 404 });
      }
    }

    // ----------------------------
    // Upload to R2
    // ----------------------------

    const mimeType = file.type || "application/octet-stream";
    const originalName = file.name || null;
    const storageKey = makeStorageKey({ ticketId, kind, originalName });
    const bytes = file.size;

    const r2 = createR2Client();
    const bucket = getR2BucketName();

    const buffer = Buffer.from(await file.arrayBuffer());

    await r2.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: storageKey,
        Body: buffer,
        ContentType: mimeType,
      }),
    );

    // ----------------------------
    // Register asset in DB
    // ----------------------------

    const width = widthStr ? parseInt(widthStr, 10) || null : null;
    const height = heightStr ? parseInt(heightStr, 10) || null : null;

    const url = await resolveAssetUrl(storageKey, null);

    const asset = await prisma.asset.create({
      data: {
        ticketId,
        revisionId,
        kind,
        storageKey,
        url,
        mimeType,
        bytes,
        width,
        height,
        originalName,
        createdById: user.id,
      },
      select: {
        id: true,
        ticketId: true,
        revisionId: true,
        kind: true,
        storageKey: true,
        url: true,
        mimeType: true,
        bytes: true,
        width: true,
        height: true,
        originalName: true,
        createdAt: true,
      },
    });

    // Ensure the returned URL is always displayable
    const resolvedUrl = asset.url ?? (await resolveAssetUrl(storageKey, null));

    return NextResponse.json({
      asset: { ...asset, url: resolvedUrl },
    });
  } catch (err: any) {
    const code = err?.code ?? "UNKNOWN";
    if (code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }

    if (code === "MISSING_ENV" || String(err?.message ?? "").startsWith("MISSING_ENV:")) {
      return NextResponse.json(
        { error: "R2_NOT_CONFIGURED", details: String(err?.message ?? "") },
        { status: 500 },
      );
    }

    console.error("[r2/upload] unexpected error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
