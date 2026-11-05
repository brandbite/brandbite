// -----------------------------------------------------------------------------
// @file: app/api/customer/ticket-drafts/[draftId]/attachments/[attachmentId]/route.ts
// @purpose: Removes a file from the signed-in person's own draft.
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteR2Objects } from "@/lib/r2";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ draftId: string; attachmentId: string }> };

export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUserOrThrow();
    const { draftId, attachmentId } = await params;

    const attachment =
      user.role === "CUSTOMER" && user.activeCompanyId
        ? await prisma.ticketDraftAttachment.findFirst({
            where: {
              id: attachmentId,
              draft: { id: draftId, createdById: user.id, companyId: user.activeCompanyId },
            },
            select: { id: true, storageKey: true },
          })
        : null;

    if (!attachment) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    await prisma.ticketDraftAttachment.delete({ where: { id: attachment.id } });
    await deleteR2Objects([attachment.storageKey]);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[customer.ticket-drafts] attachment DELETE error", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
