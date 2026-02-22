// -----------------------------------------------------------------------------
// @file: app/api/customer/projects/[projectId]/route.ts
// @purpose: Rename and delete a company-scoped project
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-12-28
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { normalizeCompanyRole, canManageProjects } from "@/lib/permissions/companyRoles";
import { parseBody } from "@/lib/schemas/helpers";
import { updateProjectSchema } from "@/lib/schemas/project.schemas";

type RouteContext = { params: Promise<{ projectId: string }> };

// ---------------------------------------------------------------------------
// PATCH — Rename a project
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json({ error: "Only customers can update projects." }, { status: 403 });
    }

    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "No active company selected." }, { status: 400 });
    }

    const companyRole = normalizeCompanyRole(user.companyRole);
    if (!canManageProjects(companyRole)) {
      return NextResponse.json(
        {
          error: "Only company owners or project managers can edit projects.",
        },
        { status: 403 },
      );
    }

    const { projectId } = await ctx.params;

    // Verify project belongs to company
    const existing = await prisma.project.findFirst({
      where: { id: projectId, companyId: user.activeCompanyId },
      select: { id: true, code: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const parsed = await parseBody(req, updateProjectSchema);
    if (!parsed.success) return parsed.response;
    const { name, code } = parsed.data;

    // If code is being changed, check per-company uniqueness
    if (code && code !== existing.code) {
      const collision = await prisma.project.findFirst({
        where: { companyId: user.activeCompanyId!, code, id: { not: projectId } },
      });
      if (collision) {
        return NextResponse.json(
          { error: `Project code "${code}" is already in use.` },
          { status: 409 },
        );
      }
    }

    const data: { name?: string; code?: string } = {};
    if (name) data.name = name;
    if (code) data.code = code;

    const project = await prisma.project.update({
      where: { id: projectId },
      data,
      select: { id: true, name: true, code: true },
    });

    return NextResponse.json({ project }, { status: 200 });
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[customer.projects.projectId] PATCH error", error);
    return NextResponse.json({ error: "Failed to update project." }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE — Delete a project and unlink its tickets
// ---------------------------------------------------------------------------

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json({ error: "Only customers can delete projects." }, { status: 403 });
    }

    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "No active company selected." }, { status: 400 });
    }

    const companyRole = normalizeCompanyRole(user.companyRole);
    if (!canManageProjects(companyRole)) {
      return NextResponse.json(
        {
          error: "Only company owners or project managers can delete projects.",
        },
        { status: 403 },
      );
    }

    const { projectId } = await ctx.params;

    // Verify project belongs to company
    const existing = await prisma.project.findFirst({
      where: { id: projectId, companyId: user.activeCompanyId },
      select: { id: true, _count: { select: { tickets: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const unlinkedTickets = existing._count.tickets;

    // Unlink tickets (set projectId to null — tickets are preserved)
    if (unlinkedTickets > 0) {
      await prisma.ticket.updateMany({
        where: { projectId },
        data: { projectId: null },
      });
    }

    // Delete project members
    await prisma.projectMember.deleteMany({
      where: { projectId },
    });

    // Delete the project
    await prisma.project.delete({
      where: { id: projectId },
    });

    return NextResponse.json({ success: true, unlinkedTickets }, { status: 200 });
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[customer.projects.projectId] DELETE error", error);
    return NextResponse.json({ error: "Failed to delete project." }, { status: 500 });
  }
}
