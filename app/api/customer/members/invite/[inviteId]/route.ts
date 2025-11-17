// -----------------------------------------------------------------------------
// @file: app/api/customer/members/invite/[inviteId]/route.ts
// @purpose: Cancel a pending company invite
// @version: v1.1.0
// @status: active
// @lastUpdate: 2025-11-17
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { InviteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import {
  canManageMembers,
  normalizeCompanyRole,
} from "@/lib/permissions/companyRoles";

type RouteParams = {
  params: {
    inviteId: string;
  };
};

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customer users can modify invites." },
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
            "Only company owners or project managers can cancel invites.",
        },
        { status: 403 },
      );
    }

    const inviteId = params.inviteId;

    const invite = await prisma.companyInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite || invite.companyId !== user.activeCompanyId) {
      return NextResponse.json(
        { error: "Invite not found." },
        { status: 404 },
      );
    }

    if (invite.status !== InviteStatus.PENDING) {
      return NextResponse.json(
        { error: "Only pending invites can be cancelled." },
        { status: 400 },
      );
    }

    await prisma.companyInvite.update({
      where: { id: inviteId },
      data: {
        status: InviteStatus.CANCELLED,
      },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error(
      "[DELETE /api/customer/members/invite/[inviteId]] error",
      error,
    );
    return NextResponse.json(
      { error: "Failed to cancel invite" },
      { status: 500 },
    );
  }
}
