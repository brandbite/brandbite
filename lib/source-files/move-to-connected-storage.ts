// -----------------------------------------------------------------------------
// @file: lib/source-files/move-to-connected-storage.ts
// @purpose: When a customer connects Google Drive or Dropbox, move the source
//           files we were keeping for them on brandbite storage (R2, 90-day
//           rule) into it, so they keep them for good. Runs right after the
//           connection (in the background, after the redirect) and again from
//           the daily maintenance cron for whatever is left. Bytes stream R2 →
//           Drive/Dropbox on the server; nothing passes through the browser.
//
//           A moved file points at its new home and loses its deletion date;
//           the R2 copy is deleted afterwards. Each file gets 3 tries.
// -----------------------------------------------------------------------------

import type { SourceFileStorage } from "@prisma/client";
import { after } from "next/server";

import {
  dropboxFilePath,
  dropboxWebUrl,
  getDropboxAccessToken,
  uploadDropboxFile,
} from "@/lib/integrations/dropbox";
import { startDriveUpload, uploadToDriveSession } from "@/lib/integrations/google-drive";
import { prisma } from "@/lib/prisma";
import { deleteR2Objects } from "@/lib/r2";
import { openSourceFileStream } from "@/lib/source-files/r2-source-files";
import {
  chooseSourceFileStorage,
  ensureDriveTicketFolder,
  loadSourceFileTicket,
  ticketFolderName,
} from "@/lib/source-files/source-files";

export const MAX_COPY_ATTEMPTS = 3;

export type MoveResult = { moved: number; failed: number; remaining: number };

/** Files of this company still on brandbite storage that could be moved. */
export function pendingMoveWhere(companyId: string) {
  return {
    storage: "R2" as const,
    status: "READY" as const,
    deletedAt: null,
    r2Key: { not: null },
    copyAttempts: { lt: MAX_COPY_ATTEMPTS },
    ticket: { companyId },
  };
}

export async function countFilesToMove(companyId: string): Promise<number> {
  return prisma.ticketSourceFile.count({ where: pendingMoveWhere(companyId) });
}

async function moveOne(
  file: { id: string; ticketId: string; name: string; mimeType: string | null; r2Key: string },
  target: SourceFileStorage,
  origin: string,
): Promise<void> {
  const ticket = await loadSourceFileTicket(file.ticketId);
  if (!ticket) throw new Error("Request not found");
  const source = await openSourceFileStream(file.r2Key);
  if (!source) throw new Error("File not found on brandbite storage");

  let externalId: string;
  let externalUrl: string | null;
  let name = file.name;
  if (target === "GOOGLE_DRIVE") {
    const { accessToken, folderId } = await ensureDriveTicketFolder(ticket, origin);
    const session = await startDriveUpload(accessToken, {
      name: file.name,
      mimeType: file.mimeType || "application/octet-stream",
      sizeBytes: source.size,
      parentId: folderId,
      origin,
    });
    const uploaded = await uploadToDriveSession(session, source.stream, source.size);
    externalId = uploaded.id;
    externalUrl = uploaded.webViewLink;
    name = uploaded.name || name;
  } else {
    const accessToken = await getDropboxAccessToken(ticket.companyId, origin);
    const path = dropboxFilePath(
      ticket.project?.name ?? "Other requests",
      ticketFolderName(ticket),
      file.name,
    );
    const uploaded = await uploadDropboxFile(accessToken, path, source.stream);
    externalId = uploaded.id;
    externalUrl = dropboxWebUrl(uploaded.pathDisplay);
    name = uploaded.name || name;
  }

  await prisma.ticketSourceFile.update({
    where: { id: file.id },
    data: {
      storage: target,
      externalId,
      externalUrl,
      name,
      r2Key: null,
      deleteAfter: null,
      reminder14SentAt: null,
      reminder3SentAt: null,
      copyError: null,
    },
  });
  await deleteR2Objects([file.r2Key]);
}

/**
 * Move this company's brandbite-stored source files into its connected
 * Drive (preferred) or Dropbox. Stops starting new files once `deadline`
 * passes; the daily cron picks up the rest.
 */
export async function moveFilesToConnectedStorage(
  companyId: string,
  origin: string,
  deadline: number = Date.now() + 4 * 60_000,
): Promise<MoveResult> {
  const result: MoveResult = { moved: 0, failed: 0, remaining: 0 };
  // Server-side uploads have no 150 MB link limit, so any size can go to Dropbox.
  const target = await chooseSourceFileStorage(companyId);
  if (target === "R2") {
    result.remaining = await countFilesToMove(companyId);
    return result;
  }

  const files = await prisma.ticketSourceFile.findMany({
    where: pendingMoveWhere(companyId),
    select: { id: true, ticketId: true, name: true, mimeType: true, r2Key: true },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  for (const file of files) {
    if (Date.now() > deadline) break;
    try {
      await moveOne({ ...file, r2Key: file.r2Key! }, target, origin);
      result.moved += 1;
    } catch (error) {
      result.failed += 1;
      await prisma.ticketSourceFile.update({
        where: { id: file.id },
        data: {
          copyAttempts: { increment: 1 },
          copyError: (error instanceof Error ? error.message : String(error)).slice(0, 500),
        },
      });
      console.warn("[source-files] move to connected storage failed", file.id, error);
    }
  }
  result.remaining = await countFilesToMove(companyId);
  return result;
}

/** Daily: every company with a working drive and files still on brandbite storage. */
export async function moveFilesForAllCompanies(
  origin: string,
  deadline: number,
): Promise<MoveResult> {
  const total: MoveResult = { moved: 0, failed: 0, remaining: 0 };
  const companies = await prisma.companyIntegration.findMany({
    where: { status: "CONNECTED", provider: { in: ["GOOGLE_DRIVE", "DROPBOX"] } },
    select: { companyId: true },
    distinct: ["companyId"],
  });
  for (const { companyId } of companies) {
    if (Date.now() > deadline) break;
    if ((await countFilesToMove(companyId)) === 0) continue;
    const r = await moveFilesToConnectedStorage(companyId, origin, deadline);
    total.moved += r.moved;
    total.failed += r.failed;
    total.remaining += r.remaining;
  }
  return total;
}

/**
 * Right after a connection: move files once the redirect has gone out.
 * Outside a request (scripts, tests) `after` throws, so just start it.
 */
export function scheduleMoveAfterConnect(companyId: string, origin: string): void {
  const run = () =>
    moveFilesToConnectedStorage(companyId, origin).catch((err) =>
      console.error("[integrations] moving files after connect failed", err),
    );
  try {
    after(run);
  } catch {
    void run();
  }
}
