// -----------------------------------------------------------------------------
// @file: app/api/customer/ticket-drafts/route.ts
// @purpose: The signed-in person's own request drafts: list and create.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { canCreateTickets } from "@/lib/permissions/companyRoles";
import { prisma } from "@/lib/prisma";
import {
  DRAFT_ATTACHMENT_SELECT,
  draftToClient,
  draftToRow,
  ticketDraftFieldsSchema,
} from "@/lib/ticket-drafts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(error: unknown, label: string) {
  if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  console.error(`[customer.ticket-drafts] ${label} error`, error);
  return NextResponse.json({ error: "Failed to process the draft" }, { status: 500 });
}

export async function GET() {
  try {
    const user = await getCurrentUserOrThrow();
    if (user.role !== "CUSTOMER" || !user.activeCompanyId) {
      return NextResponse.json({ drafts: [] });
    }

    const drafts = await prisma.ticketDraft.findMany({
      where: { createdById: user.id, companyId: user.activeCompanyId },
      include: { attachments: { select: DRAFT_ATTACHMENT_SELECT } },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ drafts: drafts.map(draftToClient) });
  } catch (error) {
    return failure(error, "GET");
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    if (user.role !== "CUSTOMER" || !user.activeCompanyId) {
      return NextResponse.json({ error: "Only customers can save drafts" }, { status: 403 });
    }
    if (!canCreateTickets(user.companyRole ?? null)) {
      return NextResponse.json(
        { error: "You don't have permission to create requests for this company." },
        { status: 403 },
      );
    }

    const parsed = ticketDraftFieldsSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid draft" }, { status: 400 });
    }

    const draft = await prisma.ticketDraft.create({
      data: {
        ...draftToRow(parsed.data),
        companyId: user.activeCompanyId,
        createdById: user.id,
      },
    });

    return NextResponse.json({ draft: draftToClient(draft) }, { status: 201 });
  } catch (error) {
    return failure(error, "POST");
  }
}
