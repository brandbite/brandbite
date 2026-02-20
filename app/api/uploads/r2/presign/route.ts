// -----------------------------------------------------------------------------
// @file: app/api/uploads/r2/presign/route.ts
// @purpose: Create presigned R2 PUT URL for uploading ticket assets
// @version: v0.1.1
// @status: active
// @lastUpdate: 2025-12-27
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AssetKind } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { createR2Client, getR2BucketName } from "@/lib/r2";
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

export async function POST(req: Request) {
  try {
    const user = await getCurrentUserOrThrow();
    const body = (await req.json()) as any;

    const ticketId = body?.ticketId as string | undefined;
    const kind = body?.kind as AssetKind | undefined;
    const revisionId = (body?.revisionId as string | undefined) ?? null;
    const contentType = body?.contentType as string | undefined;
    const bytes = body?.bytes as number | undefined;
    const originalName = (body?.originalName as string | undefined) ?? null;

    if (!ticketId || !kind || !contentType || typeof bytes !== "number") {
      return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
    }

    if (kind !== "BRIEF_INPUT" && kind !== "OUTPUT_IMAGE") {
      return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
    }

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

      // IMPORTANT: do NOT rely on activeCompanyId here (demo auth picks first membership).
      // Instead verify membership against the ticket's company.
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

      // Default rule: ticket creator can upload; company admins can also upload.
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
    // Presign
    // ----------------------------

    const storageKey = makeStorageKey({ ticketId, kind, originalName });

    const r2 = createR2Client();
    const bucket = getR2BucketName();

    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      ContentType: contentType,
    });

    const expiresInSeconds = 60 * 5;
    const uploadUrl = await getSignedUrl(r2, cmd, { expiresIn: expiresInSeconds });

    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    return NextResponse.json({ uploadUrl, storageKey, expiresAt });
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

    console.error("[r2/presign] unexpected error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
