// -----------------------------------------------------------------------------
// @file: app/api/tickets/[id]/source-files/route.ts
// @purpose: A request's source files. GET lists them for anyone who can see
//           the request; POST (assigned creative) starts an upload and
//           returns a URL the browser PUTs the file to: a Google Drive
//           resumable session in the customer's Drive, or a presigned R2 URL
//           when no Drive is connected.
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import {
  dropboxFilePath,
  getDropboxAccessToken,
  getDropboxUploadLink,
} from "@/lib/integrations/dropbox";
import { startDriveUpload } from "@/lib/integrations/google-drive";
import { prisma } from "@/lib/prisma";
import { presignSourceFileUpload } from "@/lib/source-files/r2-source-files";
import {
  IntegrationBrokenError,
  R2_MAX_SOURCE_FILE_BYTES,
  R2_SOURCE_FILE_RETENTION_DAYS,
  canRemoveSourceFile,
  canUploadSourceFiles,
  canViewSourceFiles,
  chooseSourceFileStorage,
  ensureDriveTicketFolder,
  ticketFolderName,
  loadSourceFileTicket,
  r2SourceFileKey,
  sourceFileView,
} from "@/lib/source-files/source-files";

const MAX_NAME = 255;

function errorStatus(error: unknown) {
  if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }
  return null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserOrThrow();
    const ticket = await loadSourceFileTicket((await params).id);
    if (!ticket || !(await canViewSourceFiles(user, ticket))) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }
    const files = await prisma.ticketSourceFile.findMany({
      where: { ticketId: ticket.id, status: "READY", deletedAt: null },
      include: { uploadedBy: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({
      files: files.map((file) => ({
        ...sourceFileView(file),
        canRemove: canRemoveSourceFile(user, ticket, file),
      })),
      canUpload: canUploadSourceFiles(user, ticket),
      destination: await chooseSourceFileStorage(ticket.companyId),
      retentionDays: R2_SOURCE_FILE_RETENTION_DAYS,
    });
  } catch (error) {
    const handled = errorStatus(error);
    if (handled) return handled;
    console.error("[source-files] GET error", error);
    return NextResponse.json({ error: "Could not load source files." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUserOrThrow();
    const ticket = await loadSourceFileTicket((await params).id);
    if (!ticket || !(await canViewSourceFiles(user, ticket))) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }
    if (!canUploadSourceFiles(user, ticket)) {
      return NextResponse.json(
        { error: "Only the assigned creative can deliver source files, once work has started." },
        { status: 403 },
      );
    }

    const body = (await req.json().catch(() => null)) as {
      name?: unknown;
      sizeBytes?: unknown;
      mimeType?: unknown;
    } | null;
    const name = typeof body?.name === "string" ? body.name.trim().slice(0, MAX_NAME) : "";
    const sizeBytes = typeof body?.sizeBytes === "number" ? Math.floor(body.sizeBytes) : NaN;
    const mimeType =
      typeof body?.mimeType === "string" && body.mimeType
        ? body.mimeType.slice(0, 200)
        : "application/octet-stream";
    if (!name || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
    }

    const origin = new URL(req.url).origin;
    let storage = await chooseSourceFileStorage(ticket.companyId, sizeBytes);

    if (storage === "GOOGLE_DRIVE") {
      try {
        const { accessToken, folderId } = await ensureDriveTicketFolder(ticket, origin);
        const uploadUrl = await startDriveUpload(accessToken, {
          name,
          mimeType,
          sizeBytes,
          parentId: folderId,
          origin,
        });
        const file = await prisma.ticketSourceFile.create({
          data: {
            ticketId: ticket.id,
            uploadedById: user.id,
            name,
            sizeBytes: BigInt(sizeBytes),
            mimeType,
            storage: "GOOGLE_DRIVE",
          },
        });
        return NextResponse.json({
          fileId: file.id,
          storage,
          uploadUrl,
          method: "PUT",
          contentType: mimeType,
        });
      } catch (error) {
        // A Drive that stopped working must not block delivery: fall back to R2.
        if (!(error instanceof IntegrationBrokenError)) throw error;
        storage = "R2";
      }
    }

    if (storage === "DROPBOX") {
      try {
        const accessToken = await getDropboxAccessToken(ticket.companyId, origin);
        const path = dropboxFilePath(
          ticket.project?.name ?? "Other requests",
          ticketFolderName(ticket),
          name,
        );
        const uploadUrl = await getDropboxUploadLink(accessToken, path);
        const file = await prisma.ticketSourceFile.create({
          data: {
            ticketId: ticket.id,
            uploadedById: user.id,
            name,
            sizeBytes: BigInt(sizeBytes),
            mimeType,
            storage: "DROPBOX",
            // The intended path until the upload is confirmed; then Dropbox's file id.
            externalId: path,
          },
        });
        // Temporary upload links take a POST of the raw bytes.
        return NextResponse.json({
          fileId: file.id,
          storage,
          uploadUrl,
          method: "POST",
          contentType: "application/octet-stream",
        });
      } catch (error) {
        if (!(error instanceof IntegrationBrokenError)) throw error;
        storage = "R2";
      }
    }

    if (sizeBytes > R2_MAX_SOURCE_FILE_BYTES) {
      return NextResponse.json(
        {
          error:
            "Files over 5 GB need the customer's Google Drive. Ask them to connect it under Settings → Integrations, or split the file.",
        },
        { status: 413 },
      );
    }
    const file = await prisma.ticketSourceFile.create({
      data: {
        ticketId: ticket.id,
        uploadedById: user.id,
        name,
        sizeBytes: BigInt(sizeBytes),
        mimeType,
        storage: "R2",
      },
    });
    const r2Key = r2SourceFileKey(ticket.id, file.id, name);
    await prisma.ticketSourceFile.update({ where: { id: file.id }, data: { r2Key } });
    const uploadUrl = await presignSourceFileUpload(r2Key, mimeType);
    return NextResponse.json({
      fileId: file.id,
      storage: "R2",
      uploadUrl,
      method: "PUT",
      contentType: mimeType,
    });
  } catch (error) {
    const handled = errorStatus(error);
    if (handled) return handled;
    console.error("[source-files] POST error", error);
    return NextResponse.json({ error: "Could not start the upload." }, { status: 500 });
  }
}
