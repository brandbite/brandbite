// -----------------------------------------------------------------------------
// @file: app/api/moodboards/route.ts
// @purpose: List and create moodboards. What's listed depends on who's asking;
//           the rules are in lib/moodboard-access.ts.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { MOODBOARD_ACCESS_SELECT, moodboardAccess } from "@/lib/moodboard-access";
import { canManageMoodboards } from "@/lib/permissions/companyRoles";
import { prisma } from "@/lib/prisma";
import { isSiteAdminRole } from "@/lib/roles";
import { buildTicketCode } from "@/lib/ticket-code";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId") ?? undefined;
    const ticketId = searchParams.get("ticketId") ?? undefined;

    let where: Prisma.MoodboardWhereInput;
    if (isSiteAdminRole(user.role)) {
      where = {};
    } else if (user.role === "DESIGNER") {
      where = {
        OR: [
          { companyId: null, createdById: user.id },
          { companyId: { not: null }, ticket: { creativeId: user.id } },
        ],
      };
    } else if (user.role === "CUSTOMER") {
      if (!user.activeCompanyId) {
        return NextResponse.json({ error: "No active company" }, { status: 400 });
      }
      where = {
        OR: [
          { companyId: user.activeCompanyId },
          {
            companyId: null,
            sharedWithCustomer: true,
            ticket: { companyId: user.activeCompanyId },
          },
        ],
      };
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const moodboards = await prisma.moodboard.findMany({
      where: {
        ...where,
        ...(projectId ? { projectId } : {}),
        ...(ticketId ? { ticketId } : {}),
      },
      include: {
        project: { select: { id: true, name: true } },
        company: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        ticket: {
          select: {
            ...MOODBOARD_ACCESS_SELECT.ticket.select,
            id: true,
            title: true,
            companyTicketNumber: true,
            project: { select: { code: true } },
          },
        },
        _count: { select: { items: { where: { deletedAt: null } } } },
        items: {
          where: { deletedAt: null, type: { not: "DRAWING" } },
          orderBy: { position: "asc" },
          take: 4,
          select: { id: true, type: true, data: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const isAdmin = isSiteAdminRole(user.role);

    return NextResponse.json({
      moodboards: moodboards.map((mb) => {
        const access = moodboardAccess(user, mb);
        return {
          id: mb.id,
          title: mb.title,
          description: mb.description,
          projectId: mb.project?.id ?? null,
          projectName: mb.project?.name ?? null,
          ticketId: mb.ticket?.id ?? null,
          ticketTitle: mb.ticket?.title ?? null,
          ticketCode: mb.ticket
            ? buildTicketCode({
                projectCode: mb.ticket.project?.code,
                companyTicketNumber: mb.ticket.companyTicketNumber,
                ticketId: mb.ticket.id,
              })
            : null,
          itemCount: mb._count.items,
          thumbnails: mb.items.map((item) => ({
            type: item.type,
            ...(item.data as Record<string, unknown>),
          })),
          access,
          isCreativeBoard: mb.companyId === null,
          sharedWithCustomer: mb.sharedWithCustomer,
          // The people behind a board are only named to the brandbite team.
          ...(isAdmin
            ? {
                companyName: mb.company?.name ?? null,
                createdByName: mb.createdBy.name || mb.createdBy.email,
              }
            : {}),
          createdAt: mb.createdAt.toISOString(),
          updatedAt: mb.updatedAt.toISOString(),
        };
      }),
    });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[moodboards] GET error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER" && user.role !== "DESIGNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const raw = body as Record<string, unknown>;
    const title = String(raw.title ?? "").trim();
    const description = typeof raw.description === "string" ? raw.description.trim() || null : null;
    const projectId =
      typeof raw.projectId === "string" && raw.projectId.length > 0 ? raw.projectId : null;
    const ticketId =
      typeof raw.ticketId === "string" && raw.ticketId.length > 0 ? raw.ticketId : null;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    let companyId: string | null = null;

    if (user.role === "DESIGNER") {
      if (ticketId) {
        const ticket = await prisma.ticket.findFirst({
          where: { id: ticketId, creativeId: user.id },
          select: { id: true },
        });
        if (!ticket) {
          return NextResponse.json({ error: "Request not found" }, { status: 400 });
        }
      }
    } else {
      if (!user.activeCompanyId) {
        return NextResponse.json({ error: "No active company" }, { status: 400 });
      }
      if (!canManageMoodboards(user.companyRole ?? null)) {
        return NextResponse.json(
          { error: "You don't have permission to manage moodboards" },
          { status: 403 },
        );
      }
      companyId = user.activeCompanyId;

      if (projectId) {
        const project = await prisma.project.findFirst({
          where: { id: projectId, companyId },
          select: { id: true },
        });
        if (!project) {
          return NextResponse.json(
            { error: "Project not found for this company" },
            { status: 400 },
          );
        }
      }
      if (ticketId) {
        const ticket = await prisma.ticket.findFirst({
          where: { id: ticketId, companyId },
          select: { id: true },
        });
        if (!ticket) {
          return NextResponse.json(
            { error: "Request not found for this company" },
            { status: 400 },
          );
        }
      }
    }

    const moodboard = await prisma.moodboard.create({
      data: {
        title,
        description,
        companyId,
        projectId: user.role === "DESIGNER" ? null : projectId,
        ticketId,
        createdById: user.id,
      },
      include: {
        project: { select: { id: true, name: true } },
        ticket: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json(
      {
        moodboard: {
          id: moodboard.id,
          title: moodboard.title,
          description: moodboard.description,
          projectId: moodboard.project?.id ?? null,
          projectName: moodboard.project?.name ?? null,
          ticketId: moodboard.ticket?.id ?? null,
          ticketTitle: moodboard.ticket?.title ?? null,
          createdAt: moodboard.createdAt.toISOString(),
          updatedAt: moodboard.updatedAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[moodboards] POST error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
