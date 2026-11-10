// -----------------------------------------------------------------------------
// @file: lib/source-files/source-files.ts
// @purpose: Source-file delivery on a request: who may see and upload, where
//           a new file goes (the customer's Google Drive when connected,
//           otherwise our R2 bucket) and the Drive folder layout
//           brandbite/<Project>/<CODE Title>/. Bytes never pass through our
//           servers; the browser uploads straight to Google or R2.
// -----------------------------------------------------------------------------

import type { SourceFileStorage, TicketSourceFile, TicketStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isSiteAdminRole } from "@/lib/roles";
import type { AppUserRole } from "@/lib/roles";
import { buildTicketCode } from "@/lib/ticket-code";
import {
  IntegrationBrokenError,
  createFolder,
  driveSafeName,
  ensureRootFolder,
  getDriveAccessToken,
  isUsableFolder,
} from "@/lib/integrations/google-drive";
import { isProviderAvailable } from "@/lib/integrations/company-integrations";
import { DROPBOX_MAX_LINK_UPLOAD_BYTES } from "@/lib/integrations/dropbox";

/** Days R2 source files are kept after the request is done. */
export const R2_SOURCE_FILE_RETENTION_DAYS = 90;
/** A single presigned PUT to R2 tops out at 5 GB. */
export const R2_MAX_SOURCE_FILE_BYTES = 5 * 1024 * 1024 * 1024;

/** Creatives deliver source files once work has started, and after approval too. */
export const SOURCE_FILE_UPLOAD_STATUSES: TicketStatus[] = ["IN_PROGRESS", "IN_REVIEW", "DONE"];

export type SourceFileUser = { id: string; role: AppUserRole };

export type SourceFileTicket = {
  id: string;
  companyId: string;
  creativeId: string | null;
  status: TicketStatus;
  title: string;
  companyTicketNumber: number | null;
  completedAt: Date | null;
  project: { id: string; name: string; code: string | null } | null;
};

export async function loadSourceFileTicket(ticketId: string): Promise<SourceFileTicket | null> {
  return prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      companyId: true,
      creativeId: true,
      status: true,
      title: true,
      companyTicketNumber: true,
      completedAt: true,
      project: { select: { id: true, name: true, code: true } },
    },
  });
}

/** Company members, the assigned creative and site admins see a request's source files. */
export async function canViewSourceFiles(
  user: SourceFileUser,
  ticket: SourceFileTicket,
): Promise<boolean> {
  if (isSiteAdminRole(user.role)) return true;
  if (user.role === "DESIGNER") return ticket.creativeId === user.id;
  if (user.role !== "CUSTOMER") return false;
  const membership = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId: ticket.companyId, userId: user.id } },
    select: { id: true },
  });
  return Boolean(membership);
}

/** Only the assigned creative uploads, once the request is in progress. */
export function canUploadSourceFiles(user: SourceFileUser, ticket: SourceFileTicket): boolean {
  return (
    user.role === "DESIGNER" &&
    ticket.creativeId === user.id &&
    SOURCE_FILE_UPLOAD_STATUSES.includes(ticket.status)
  );
}

/** The uploader may remove their file until the request is done; admins always. */
export function canRemoveSourceFile(
  user: SourceFileUser,
  ticket: SourceFileTicket,
  file: Pick<TicketSourceFile, "uploadedById">,
): boolean {
  if (isSiteAdminRole(user.role)) return true;
  return (
    user.role === "DESIGNER" &&
    file.uploadedById === user.id &&
    ticket.creativeId === user.id &&
    ticket.status !== "DONE"
  );
}

/**
 * Where the next source file for this company goes: its Google Drive when
 * connected and working, else its Dropbox (files up to 150 MB, Dropbox's
 * limit for an upload without handing the browser a token), else R2. A
 * connection that needs reconnecting falls back, so delivery never blocks.
 * Without `sizeBytes` it answers for a typical file (for the "files go to…" line).
 */
export async function chooseSourceFileStorage(
  companyId: string,
  sizeBytes?: number,
): Promise<SourceFileStorage> {
  const connected = await prisma.companyIntegration.findMany({
    where: { companyId, status: "CONNECTED", provider: { in: ["GOOGLE_DRIVE", "DROPBOX"] } },
    select: { provider: true },
  });
  const has = (p: "GOOGLE_DRIVE" | "DROPBOX") =>
    isProviderAvailable(p) && connected.some((c) => c.provider === p);
  if (has("GOOGLE_DRIVE")) return "GOOGLE_DRIVE";
  if (has("DROPBOX") && (sizeBytes === undefined || sizeBytes <= DROPBOX_MAX_LINK_UPLOAD_BYTES)) {
    return "DROPBOX";
  }
  return "R2";
}

/** "WEB-101 Logo redesign" */
export function ticketFolderName(ticket: SourceFileTicket): string {
  const code = buildTicketCode({
    projectCode: ticket.project?.code,
    companyTicketNumber: ticket.companyTicketNumber,
    ticketId: ticket.id,
  });
  return driveSafeName(`${code} ${ticket.title}`);
}

async function cachedFolder(
  companyId: string,
  key: string,
  accessToken: string,
  create: () => Promise<string>,
): Promise<string> {
  const existing = await prisma.integrationFolder.findUnique({
    where: { companyId_provider_key: { companyId, provider: "GOOGLE_DRIVE", key } },
    select: { folderId: true },
  });
  if (existing && (await isUsableFolder(accessToken, existing.folderId))) return existing.folderId;
  const folderId = await create();
  await prisma.integrationFolder.upsert({
    where: { companyId_provider_key: { companyId, provider: "GOOGLE_DRIVE", key } },
    create: { companyId, provider: "GOOGLE_DRIVE", key, folderId },
    update: { folderId },
  });
  return folderId;
}

/**
 * The request's folder in the customer's Drive, creating
 * brandbite/<Project>/<CODE Title>/ on first use. Folder ids are remembered,
 * and recreated when the customer deleted or trashed one.
 */
export async function ensureDriveTicketFolder(
  ticket: SourceFileTicket,
  origin: string,
): Promise<{ accessToken: string; folderId: string }> {
  const { accessToken, rootFolderId } = await getDriveAccessToken(ticket.companyId, origin);

  let rootId = rootFolderId;
  if (!rootId || !(await isUsableFolder(accessToken, rootId))) {
    rootId = await ensureRootFolder(accessToken, null);
    await prisma.companyIntegration.update({
      where: { companyId_provider: { companyId: ticket.companyId, provider: "GOOGLE_DRIVE" } },
      data: { externalRootId: rootId },
    });
  }
  const root = rootId;

  const projectKey = `project:${ticket.project?.id ?? "none"}:${root}`;
  const projectFolder = await cachedFolder(ticket.companyId, projectKey, accessToken, () =>
    createFolder(accessToken, driveSafeName(ticket.project?.name ?? "Other requests"), root),
  );
  const ticketFolder = await cachedFolder(
    ticket.companyId,
    `ticket:${ticket.id}:${projectFolder}`,
    accessToken,
    () => createFolder(accessToken, ticketFolderName(ticket), projectFolder),
  );
  return { accessToken, folderId: ticketFolder };
}

/** R2 object key for a source file. */
export function r2SourceFileKey(ticketId: string, fileId: string, name: string): string {
  const safe = name
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
  return `tickets/${ticketId}/source/${fileId}_${safe || "file"}`;
}

/** When an R2 file may be purged: 90 days after the request is done. */
export function r2DeleteAfter(completedAt: Date | null): Date | null {
  if (!completedAt) return null;
  return new Date(completedAt.getTime() + R2_SOURCE_FILE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

/** Browser-safe view of a source file. */
export function sourceFileView(
  file: TicketSourceFile & { uploadedBy?: { name: string | null; email: string } | null },
) {
  return {
    id: file.id,
    name: file.name,
    sizeBytes: Number(file.sizeBytes),
    mimeType: file.mimeType,
    storage: file.storage,
    status: file.status,
    externalUrl: file.externalUrl,
    deleteAfter: file.deleteAfter?.toISOString() ?? null,
    uploadedBy: file.uploadedBy ? file.uploadedBy.name || file.uploadedBy.email : null,
    uploadedById: file.uploadedById,
    createdAt: file.createdAt.toISOString(),
  };
}

export { IntegrationBrokenError };
