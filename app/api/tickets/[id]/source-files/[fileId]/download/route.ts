// -----------------------------------------------------------------------------
// @file: app/api/tickets/[id]/source-files/[fileId]/download/route.ts
// @purpose: Open or download a source file. R2 files redirect to a short-lived
//           presigned URL (straight from R2, so egress stays free); Drive
//           files redirect to the file in the customer's Google Drive.
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { presignSourceFileDownload } from "@/lib/source-files/r2-source-files";
import { canViewSourceFiles, loadSourceFileTicket } from "@/lib/source-files/source-files";

export async function GET(
  _req: NextRequest,
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
      where: { id: fileId, ticketId: ticket.id, status: "READY", deletedAt: null },
    });
    if (!file) return NextResponse.json({ error: "File not found." }, { status: 404 });

    if (file.storage === "R2" && file.r2Key) {
      return NextResponse.redirect(await presignSourceFileDownload(file.r2Key, file.name));
    }
    if (file.externalUrl) return NextResponse.redirect(file.externalUrl);
    return NextResponse.json({ error: "This file can't be opened here." }, { status: 404 });
  } catch (error) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }
    console.error("[source-files] download error", error);
    return NextResponse.json({ error: "Could not open the file." }, { status: 500 });
  }
}
