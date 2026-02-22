// -----------------------------------------------------------------------------
// @file: app/api/customer/tags/[tagId]/route.ts
// @purpose: Update and delete a company-scoped ticket tag
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-12-18
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { normalizeCompanyRole, canManageTags } from "@/lib/permissions/companyRoles";
import { parseBody } from "@/lib/schemas/helpers";
import { updateTagSchema } from "@/lib/schemas/tag.schemas";

type RouteContext = { params: Promise<{ tagId: string }> };

// ---------------------------------------------------------------------------
// PATCH — Update a tag's name and/or color
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json({ error: "Only customers can update tags." }, { status: 403 });
    }

    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "No active company selected." }, { status: 400 });
    }

    const companyRole = normalizeCompanyRole(user.companyRole);
    if (!canManageTags(companyRole)) {
      return NextResponse.json(
        {
          error: "Only company owners or project managers can edit tags.",
        },
        { status: 403 },
      );
    }

    const { tagId } = await ctx.params;

    // Verify tag belongs to company
    const existing = await prisma.ticketTag.findFirst({
      where: { id: tagId, companyId: user.activeCompanyId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Tag not found." }, { status: 404 });
    }

    const parsed = await parseBody(req, updateTagSchema);
    if (!parsed.success) return parsed.response;
    const updateData: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.color !== undefined) updateData.color = parsed.data.color;

    try {
      const tag = await prisma.ticketTag.update({
        where: { id: tagId },
        data: updateData,
        select: { id: true, name: true, color: true },
      });

      return NextResponse.json({ tag }, { status: 200 });
    } catch (err: any) {
      if (err?.code === "P2002") {
        return NextResponse.json(
          { error: "A tag with that name already exists in your company." },
          { status: 409 },
        );
      }
      throw err;
    }
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[customer.tags.tagId] PATCH error", error);
    return NextResponse.json({ error: "Failed to update tag." }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE — Delete a tag and remove all its ticket assignments
// ---------------------------------------------------------------------------

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json({ error: "Only customers can delete tags." }, { status: 403 });
    }

    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "No active company selected." }, { status: 400 });
    }

    const companyRole = normalizeCompanyRole(user.companyRole);
    if (!canManageTags(companyRole)) {
      return NextResponse.json(
        {
          error: "Only company owners or project managers can delete tags.",
        },
        { status: 403 },
      );
    }

    const { tagId } = await ctx.params;

    // Verify tag belongs to company
    const existing = await prisma.ticketTag.findFirst({
      where: { id: tagId, companyId: user.activeCompanyId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Tag not found." }, { status: 404 });
    }

    // Delete all assignments first, then the tag
    await prisma.ticketTagAssignment.deleteMany({
      where: { tagId },
    });

    await prisma.ticketTag.delete({
      where: { id: tagId },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[customer.tags.tagId] DELETE error", error);
    return NextResponse.json({ error: "Failed to delete tag." }, { status: 500 });
  }
}
