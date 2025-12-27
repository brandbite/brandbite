// -----------------------------------------------------------------------------
// @file: app/api/assets/register/route.ts
// @purpose: Register an uploaded asset in DB after successful R2 upload
// @version: v0.1.1
// @status: active
// @lastUpdate: 2025-12-27
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { AssetKind } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { getR2PublicBaseUrl } from "@/lib/r2";
import { isCompanyAdminRole } from "@/lib/permissions/companyRoles";

function buildPublicUrl(storageKey: string): string | null {
  const base = getR2PublicBaseUrl();
  if (!base) return null;
  const trimmed = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${trimmed}/${storageKey}`;
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUserOrThrow();
    const body = (await req.json()) as any;

    const ticketId = body?.ticketId as string | undefined;
    const kind = body?.kind as AssetKind | undefined;
    const revisionId = (body?.revisionId as string | undefined) ?? null;

    const storageKey = body?.storageKey as string | undefined;
    const mimeType = body?.mimeType as string | undefined;
    const bytes = body?.bytes as number | undefined;

    const width = (body?.width as number | undefined) ?? null;
    const height = (body?.height as number | undefined) ?? null;
    const originalName = (body?.originalName as string | undefined) ?? null;

    if (!ticketId || !kind || !storageKey || !mimeType || typeof bytes !== "number") {
      return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
    }

    if (kind !== "BRIEF_INPUT" && kind !== "OUTPUT_IMAGE") {
      return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        companyId: true,
        createdById: true,
        designerId: true,
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    if (kind === "BRIEF_INPUT") {
      if (user.role !== "CUSTOMER") {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
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

      if (ticket.createdById !== user.id && !isCompanyAdminRole(membership.roleInCompany)) {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      }
    }

    if (kind === "OUTPUT_IMAGE") {
      if (user.role !== "DESIGNER") {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      }
      if (!ticket.designerId || ticket.designerId !== user.id) {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      }
      if (!revisionId) {
        return NextResponse.json({ error: "REVISION_REQUIRED" }, { status: 400 });
      }

      const rev = await prisma.ticketRevision.findFirst({
        where: { id: revisionId, ticketId },
        select: { id: true },
      });

      if (!rev) {
        return NextResponse.json({ error: "REVISION_NOT_FOUND" }, { status: 404 });
      }
    }

    const url = buildPublicUrl(storageKey);

    const asset = await prisma.asset.create({
      data: {
        ticketId,
        revisionId,
        kind,
        storageKey,
        url,
        mimeType,
        bytes,
        width,
        height,
        originalName,
        createdById: user.id,
      },
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

    return NextResponse.json({ asset });
  } catch (err: any) {
    const code = err?.code ?? "UNKNOWN";
    if (code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }

    console.error("[assets/register] unexpected error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
