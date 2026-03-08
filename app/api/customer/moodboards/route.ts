// -----------------------------------------------------------------------------
// @file: app/api/customer/moodboards/route.ts
// @purpose: Customer-facing moodboard list & creation API
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-03-09
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { canManageMoodboards } from "@/lib/permissions/companyRoles";

// -----------------------------------------------------------------------------
// GET: list moodboards for the current customer's active company
// -----------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customers can access moodboards" },
        { status: 403 },
      );
    }
    if (!user.activeCompanyId) {
      return NextResponse.json(
        { error: "No active company" },
        { status: 400 },
      );
    }

    // Optional project filter
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId") ?? undefined;

    const where: Record<string, unknown> = {
      companyId: user.activeCompanyId,
    };
    if (projectId) {
      where.projectId = projectId;
    }

    const moodboards = await prisma.moodboard.findMany({
      where,
      include: {
        project: {
          select: { id: true, name: true },
        },
        _count: {
          select: { items: true },
        },
        items: {
          where: { type: "IMAGE" },
          orderBy: { position: "asc" },
          take: 3,
          select: {
            id: true,
            data: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      moodboards: moodboards.map((mb) => ({
        id: mb.id,
        title: mb.title,
        description: mb.description,
        projectId: mb.project?.id ?? null,
        projectName: mb.project?.name ?? null,
        itemCount: mb._count.items,
        thumbnails: mb.items.map((item) => item.data),
        createdAt: mb.createdAt.toISOString(),
        updatedAt: mb.updatedAt.toISOString(),
      })),
    });
  } catch (err: any) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "UNAUTHENTICATED" },
        { status: 401 },
      );
    }
    console.error("[moodboards] GET error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}

// -----------------------------------------------------------------------------
// POST: create a new moodboard
// -----------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customers can access moodboards" },
        { status: 403 },
      );
    }
    if (!user.activeCompanyId) {
      return NextResponse.json(
        { error: "No active company" },
        { status: 400 },
      );
    }

    // Permission check
    if (!canManageMoodboards(user.companyRole ?? null)) {
      return NextResponse.json(
        { error: "You don't have permission to manage moodboards" },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const raw = body as Record<string, unknown>;
    const title = String(raw.title ?? "").trim();
    const description =
      typeof raw.description === "string" ? raw.description.trim() || null : null;
    const projectId =
      typeof raw.projectId === "string" && raw.projectId.length > 0
        ? raw.projectId
        : null;
    const ticketId =
      typeof raw.ticketId === "string" && raw.ticketId.length > 0
        ? raw.ticketId
        : null;

    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 },
      );
    }

    // Verify project belongs to the same company
    if (projectId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, companyId: user.activeCompanyId },
        select: { id: true },
      });
      if (!project) {
        return NextResponse.json(
          { error: "Project not found for this company" },
          { status: 400 },
        );
      }
    }

    // Verify ticket belongs to the same company
    if (ticketId) {
      const ticket = await prisma.ticket.findFirst({
        where: { id: ticketId, companyId: user.activeCompanyId },
        select: { id: true },
      });
      if (!ticket) {
        return NextResponse.json(
          { error: "Ticket not found for this company" },
          { status: 400 },
        );
      }
    }

    const moodboard = await prisma.moodboard.create({
      data: {
        title,
        description,
        companyId: user.activeCompanyId,
        projectId,
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
      return NextResponse.json(
        { error: "UNAUTHENTICATED" },
        { status: 401 },
      );
    }
    console.error("[moodboards] POST error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
