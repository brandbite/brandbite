// -----------------------------------------------------------------------------
// @file: app/api/customer/members/invite/[inviteId]/route.ts
// @purpose: Cancel a pending company invite
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-16
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { CompanyRole, InviteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";

const ALLOWED_CANCEL_ROLES: CompanyRole[] = ["OWNER", "PM"];

type RouteParams = {
  params: {
    inviteId: string;
  };
};

export async function DELETE(
  _req: NextRequest,
  { params }: RouteParams,
) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customers can cancel invites" },
        { status: 403 },
      );
    }

    if (!user.activeCompanyId) {
      return NextResponse.json(
        { error: "User has no active company" },
        { status: 400 },
      );
    }

    if (
      !user.companyRole ||
      !ALLOWED_CANCEL_ROLES.includes(user.companyRole as CompanyRole)
    ) {
      return NextResponse.json(
        {
          error:
            "Only company owners or project managers can cancel invites",
        },
        { status: 403 },
      );
    }

    const inviteId = params.inviteId;

    const invite = await prisma.companyInvite.findFirst({
      where: {
        id: inviteId,
        companyId: user.activeCompanyId,
      },
    });

    if (!invite) {
      return NextResponse.json(
        { error: "Invite not found" },
        { status: 404 },
      );
    }

    if (invite.status !== InviteStatus.PENDING) {
      return NextResponse.json(
        { error: "Only pending invites can be cancelled" },
        { status: 400 },
      );
    }

    await prisma.companyInvite.update({
      where: { id: invite.id },
      data: {
        status: InviteStatus.CANCELLED,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        inviteId: invite.id,
        newStatus: InviteStatus.CANCELLED,
      },
      { status: 200 },
    );
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
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
