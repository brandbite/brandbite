// -----------------------------------------------------------------------------
// @file: app/api/customer/ticket-drafts/[draftId]/route.ts
// @purpose: One of the signed-in person's own drafts: read, save, delete. Anyone
//           else's draft doesn't exist as far as this route is concerned.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteR2Objects } from "@/lib/r2";
import {
  DRAFT_ATTACHMENT_SELECT,
  draftToClient,
  draftToRow,
  ticketDraftFieldsSchema,
} from "@/lib/ticket-drafts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ draftId: string }> };

function failure(error: unknown, label: string) {
  if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  console.error(`[customer.ticket-drafts] ${label} error`, error);
  return NextResponse.json({ error: "Failed to process the draft" }, { status: 500 });
}

const NOT_FOUND = () => NextResponse.json({ error: "Draft not found" }, { status: 404 });

async function ownDraft(draftId: string) {
  const user = await getCurrentUserOrThrow();
  if (user.role !== "CUSTOMER" || !user.activeCompanyId) return null;
  return prisma.ticketDraft.findFirst({
    where: { id: draftId, createdById: user.id, companyId: user.activeCompanyId },
    include: { attachments: { select: { ...DRAFT_ATTACHMENT_SELECT, storageKey: true } } },
  });
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { draftId } = await params;
    const draft = await ownDraft(draftId);
    if (!draft) return NOT_FOUND();
    return NextResponse.json({ draft: draftToClient(draft) });
  } catch (error) {
    return failure(error, "GET");
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { draftId } = await params;
    const draft = await ownDraft(draftId);
    if (!draft) return NOT_FOUND();

    const parsed = ticketDraftFieldsSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid draft" }, { status: 400 });
    }

    const updated = await prisma.ticketDraft.update({
      where: { id: draft.id },
      data: draftToRow(parsed.data),
    });

    return NextResponse.json({ updatedAt: updated.updatedAt.toISOString() });
  } catch (error) {
    return failure(error, "PATCH");
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { draftId } = await params;
    const draft = await ownDraft(draftId);
    if (!draft) return NOT_FOUND();

    await prisma.ticketDraft.delete({ where: { id: draft.id } });
    await deleteR2Objects(draft.attachments.map((a) => a.storageKey));

    return NextResponse.json({ success: true });
  } catch (error) {
    return failure(error, "DELETE");
  }
}
