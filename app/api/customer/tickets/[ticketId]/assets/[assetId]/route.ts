// -----------------------------------------------------------------------------
// @file: app/api/customer/tickets/[ticketId]/assets/[assetId]/route.ts
// @purpose: Soft-delete a brief attachment (customer side)
// @status: active
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isCompanyAdminRole } from "@/lib/permissions/companyRoles";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ ticketId: string; assetId: string }> },
) {
  try {
    const user = await getCurrentUserOrThrow();
    const { ticketId, assetId } = await ctx.params;

    if (user.role !== "CUSTOMER") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, companyId: true, createdById: true, status: true },
    });

    if (!ticket) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

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

    // Same gate as uploading briefs: the ticket creator or a company admin.
    if (ticket.createdById !== user.id && !isCompanyAdminRole(membership.roleInCompany)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    // Briefs can only be removed before the designer starts work, matching
    // the "Add files" affordance which is only offered on To-do tickets.
    if (ticket.status !== "TODO") {
      return NextResponse.json({ error: "TICKET_NOT_EDITABLE" }, { status: 409 });
    }

    const asset = await prisma.asset.findFirst({
      where: { id: assetId, ticketId, kind: "BRIEF_INPUT", deletedAt: null },
      select: { id: true },
    });

    if (!asset) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    await prisma.asset.update({
      where: { id: assetId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const code = err?.code ?? "UNKNOWN";
    if (code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[customer/tickets/:ticketId/assets/:assetId DELETE] error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
