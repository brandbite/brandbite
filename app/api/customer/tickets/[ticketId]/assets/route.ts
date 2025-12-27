// -----------------------------------------------------------------------------
// @file: app/api/customer/tickets/[ticketId]/assets/route.ts
// @purpose: List ticket assets for customer (filtered by kind)
// @version: v0.1.0
// @status: active
// @lastUpdate: 2025-12-27
// -----------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { AssetKind } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ ticketId: string }> },
) {
  try {
    const user = await getCurrentUserOrThrow();
    const { ticketId } = await ctx.params;

    if (user.role !== "CUSTOMER") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const url = new URL(_req.url);
    const kindRaw = url.searchParams.get("kind") ?? "BRIEF_INPUT";

    const kind: AssetKind =
      kindRaw === "BRIEF_INPUT" || kindRaw === "OUTPUT_IMAGE"
        ? (kindRaw as AssetKind)
        : "BRIEF_INPUT";

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, companyId: true, createdById: true },
    });

    if (!ticket) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    // Must be in the same company
    const membership = await prisma.companyMember.findUnique({
      where: {
        companyId_userId: {
          companyId: ticket.companyId,
          userId: user.id,
        },
      },
      select: { id: true },
    });

    if (!membership) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const assets = await prisma.asset.findMany({
      where: {
        ticketId,
        kind,
        deletedAt: null,
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        ticketId: true,
        revisionId: true,
        kind: true,
        storageKey: true,
        url: true,
        mimeType: true,
        bytes: true,
        width: true,
        height: true,
        originalName: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ assets });
  } catch (err: any) {
    const code = err?.code ?? "UNKNOWN";
    if (code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[customer/tickets/:ticketId/assets] error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
