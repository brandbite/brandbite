// -----------------------------------------------------------------------------
// @file: app/api/tickets/[id]/source-files/[fileId]/complete/route.ts
// @purpose: The browser finished its PUT. Check with the storage itself
//           (Google Drive or R2) that the file is really there at the
//           expected size before showing it, then mark it READY.
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { getDriveAccessToken, getDriveFile } from "@/lib/integrations/google-drive";
import { prisma } from "@/lib/prisma";
import { sourceFileObjectSize } from "@/lib/source-files/r2-source-files";
import {
  loadSourceFileTicket,
  r2DeleteAfter,
  sourceFileView,
} from "@/lib/source-files/source-files";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  try {
    const user = await getCurrentUserOrThrow();
    const { id, fileId } = await params;
    const ticket = await loadSourceFileTicket(id);
    const file = ticket
      ? await prisma.ticketSourceFile.findFirst({ where: { id: fileId, ticketId: ticket.id } })
      : null;
    if (!ticket || !file || file.uploadedById !== user.id) {
      return NextResponse.json({ error: "Upload not found." }, { status: 404 });
    }
    if (file.status === "READY") {
      return NextResponse.json({ file: sourceFileView(file) });
    }

    const body = (await req.json().catch(() => null)) as { externalId?: unknown } | null;
    const expected = Number(file.sizeBytes);
    const fail = async (message: string) => {
      await prisma.ticketSourceFile.update({ where: { id: file.id }, data: { status: "FAILED" } });
      return NextResponse.json({ error: message }, { status: 422 });
    };

    if (file.storage === "GOOGLE_DRIVE") {
      const externalId = typeof body?.externalId === "string" ? body.externalId : "";
      if (!externalId) return fail("Google Drive didn't confirm the upload.");
      const { accessToken } = await getDriveAccessToken(ticket.companyId, new URL(req.url).origin);
      const info = await getDriveFile(accessToken, externalId);
      if (!info || info.trashed || (info.size !== null && info.size !== expected)) {
        return fail("The file didn't arrive complete in Google Drive. Please upload it again.");
      }
      const saved = await prisma.ticketSourceFile.update({
        where: { id: file.id },
        data: { status: "READY", externalId: info.id, externalUrl: info.webViewLink },
        include: { uploadedBy: { select: { name: true, email: true } } },
      });
      return NextResponse.json({ file: sourceFileView(saved) });
    }

    if (file.storage === "R2" && file.r2Key) {
      const size = await sourceFileObjectSize(file.r2Key);
      if (size === null || size !== expected) {
        return fail("The file didn't arrive complete. Please upload it again.");
      }
      const saved = await prisma.ticketSourceFile.update({
        where: { id: file.id },
        data: { status: "READY", deleteAfter: r2DeleteAfter(ticket.completedAt) },
        include: { uploadedBy: { select: { name: true, email: true } } },
      });
      return NextResponse.json({ file: sourceFileView(saved) });
    }

    return fail("This upload can't be completed.");
  } catch (error) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }
    console.error("[source-files] complete error", error);
    return NextResponse.json({ error: "Could not finish the upload." }, { status: 500 });
  }
}
