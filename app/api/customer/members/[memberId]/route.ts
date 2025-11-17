// -----------------------------------------------------------------------------
// @file: app/api/customer/members/[memberId]/route.ts
// @purpose: Update or remove a company member (role change + removal)
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-17
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { CompanyRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import {
  canManageMembers,
  normalizeCompanyRole,
} from "@/lib/permissions/companyRoles";

type RouteParams = {
  params: {
    memberId: string;
  };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getCompanyMemberOr404(memberId: string, companyId: string) {
  const member = await prisma.companyMember.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      companyId: true,
      userId: true,
      roleInCompany: true,
    },
  });

  if (!member || member.companyId !== companyId) {
    return null;
  }

  return member;
}

async function getOwnersCount(companyId: string): Promise<number> {
  const owners = await prisma.companyMember.count({
    where: { companyId, roleInCompany: "OWNER" },
  });
  return owners;
}

// ---------------------------------------------------------------------------
// PATCH: change member role
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customer users can update members." },
        { status: 403 },
      );
    }

    if (!user.activeCompanyId) {
      return NextResponse.json(
        { error: "No active company selected." },
        { status: 400 },
      );
    }

    const companyRole = normalizeCompanyRole(user.companyRole);
    if (!canManageMembers(companyRole)) {
      return NextResponse.json(
        {
          error:
            "Only company owners or project managers can manage members.",
        },
        { status: 403 },
      );
    }

    const memberId = params.memberId;
    const targetMember = await getCompanyMemberOr404(
      memberId,
      user.activeCompanyId,
    );

    if (!targetMember) {
      return NextResponse.json(
        { error: "Member not found." },
        { status: 404 },
      );
    }

    const body = await req.json().catch(() => null);
    const nextRole = body?.roleInCompany as CompanyRole | undefined;

    if (!nextRole) {
      return NextResponse.json(
        { error: "roleInCompany is required." },
        { status: 400 },
      );
    }

    if (
      nextRole !== "OWNER" &&
      nextRole !== "PM" &&
      nextRole !== "BILLING" &&
      nextRole !== "MEMBER"
    ) {
      return NextResponse.json(
        { error: "Invalid role." },
        { status: 400 },
      );
    }

    // PM'ler OWNER'ları değiştiremez
    const isActorOwner = companyRole === "OWNER";
    const isTargetOwner = targetMember.roleInCompany === "OWNER";
    const isSelf = targetMember.userId === user.id;

    if (isTargetOwner && !isActorOwner) {
      return NextResponse.json(
        { error: "Only owners can change another owner's role." },
        { status: 403 },
      );
    }

    // OWNER → başka role: en az 1 OWNER kalmalı
    if (isTargetOwner && nextRole !== "OWNER") {
      const ownersCount = await getOwnersCount(user.activeCompanyId);
      if (ownersCount <= 1) {
        return NextResponse.json(
          {
            error:
              "You must keep at least one owner in this workspace.",
          },
          { status: 400 },
        );
      }
    }

    // Hiç değişiklik yoksa
    if (targetMember.roleInCompany === nextRole) {
      return NextResponse.json(
        { ok: true },
        { status: 200 },
      );
    }

    await prisma.companyMember.update({
      where: { id: targetMember.id },
      data: { roleInCompany: nextRole },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[PATCH /api/customer/members/[memberId]] error", error);
    return NextResponse.json(
      { error: "Failed to update member" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE: remove member from company
// ---------------------------------------------------------------------------

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customer users can remove members." },
        { status: 403 },
      );
    }

    if (!user.activeCompanyId) {
      return NextResponse.json(
        { error: "No active company selected." },
        { status: 400 },
      );
    }

    const companyRole = normalizeCompanyRole(user.companyRole);
    if (!canManageMembers(companyRole)) {
      return NextResponse.json(
        {
          error:
            "Only company owners or project managers can remove members.",
        },
        { status: 403 },
      );
    }

    const memberId = params.memberId;
    const targetMember = await getCompanyMemberOr404(
      memberId,
      user.activeCompanyId,
    );

    if (!targetMember) {
      return NextResponse.json(
        { error: "Member not found." },
        { status: 404 },
      );
    }

    const isActorOwner = companyRole === "OWNER";
    const isTargetOwner = targetMember.roleInCompany === "OWNER";
    const isSelf = targetMember.userId === user.id;

    // PM'ler OWNER'ı silemez
    if (isTargetOwner && !isActorOwner) {
      return NextResponse.json(
        { error: "Only owners can remove another owner." },
        { status: 403 },
      );
    }

    // Son OWNER'ı silme
    if (isTargetOwner) {
      const ownersCount = await getOwnersCount(user.activeCompanyId);
      if (ownersCount <= 1) {
        return NextResponse.json(
          {
            error:
              "You must keep at least one owner in this workspace.",
          },
          { status: 400 },
        );
      }
    }

    await prisma.companyMember.delete({
      where: { id: targetMember.id },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[DELETE /api/customer/members/[memberId]] error", error);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 },
    );
  }
}
