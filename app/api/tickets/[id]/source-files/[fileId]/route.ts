// -----------------------------------------------------------------------------
// @file: app/api/tickets/[id]/source-files/[fileId]/route.ts
// @purpose: Remove a delivered source file (its uploader until the request is
//           done, or a site admin). Drive files go to the customer's Drive
//           trash, so they can still restore them; R2 files are deleted.
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { deleteDropboxFile, getDropboxAccessToken } from "@/lib/integrations/dropbox";
import { getDriveAccessToken, trashDriveFile } from "@/lib/integrations/google-drive";
import { prisma } from "@/lib/prisma";
import { deleteR2Objects } from "@/lib/r2";
import {
  canRemoveSourceFile,
  canViewSourceFiles,
  loadSourceFileTicket,
} from "@/lib/source-files/source-files";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  try {
    const user = await getCurrentUserOrThrow();
    const { id, fileId } = await params;
    const ticket = await loadSourceFileTicket(id);
    if (!ticket || !(await canViewSourceFiles(user, ticket))) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }
    const file = await prisma.ticketSourceFile.findFirst({
      where: { id: fileId, ticketId: ticket.id, deletedAt: null },
    });
    if (!file) return NextResponse.json({ error: "File not found." }, { status: 404 });
    if (!canRemoveSourceFile(user, ticket, file)) {
      return NextResponse.json(
        { error: "Only the creative who uploaded it can remove it, before the request is done." },
        { status: 403 },
      );
    }

    if (file.storage === "GOOGLE_DRIVE" && file.externalId) {
      try {
        const { accessToken } = await getDriveAccessToken(
          ticket.companyId,
          new URL(req.url).origin,
        );
        await trashDriveFile(accessToken, file.externalId);
      } catch (error) {
        // A disconnected Drive keeps the file; we only stop listing it.
        console.warn("[source-files] Drive trash skipped", error);
      }
    }
    if (file.storage === "DROPBOX" && file.externalId) {
      try {
        const accessToken = await getDropboxAccessToken(ticket.companyId, new URL(req.url).origin);
        await deleteDropboxFile(accessToken, file.externalId);
      } catch (error) {
        console.warn("[source-files] Dropbox delete skipped", error);
      }
    }
    if (file.storage === "R2") await deleteR2Objects([file.r2Key]);

    await prisma.ticketSourceFile.update({
      where: { id: file.id },
      data: { deletedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }
    console.error("[source-files] DELETE error", error);
    return NextResponse.json({ error: "Could not remove the file." }, { status: 500 });
  }
}
