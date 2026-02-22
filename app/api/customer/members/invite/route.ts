// -----------------------------------------------------------------------------
// @file: app/api/customer/members/invite/route.ts
// @purpose: Create a company invite (email + role) for current customer's company
// @version: v1.1.0
// @status: active
// @lastUpdate: 2025-11-17
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { InviteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { canManageMembers, normalizeCompanyRole } from "@/lib/permissions/companyRoles";
import { randomUUID } from "crypto";
import { parseBody } from "@/lib/schemas/helpers";
import { createInviteSchema } from "@/lib/schemas/member.schemas";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json({ error: "Only customer users can send invites." }, { status: 403 });
    }

    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "No active company selected." }, { status: 400 });
    }

    const companyRole = normalizeCompanyRole(user.companyRole);
    if (!canManageMembers(companyRole)) {
      return NextResponse.json(
        {
          error: "Only company owners or project managers can send invites.",
        },
        { status: 403 },
      );
    }

    const parsed = await parseBody(req, createInviteSchema);
    if (!parsed.success) return parsed.response;
    const { email, roleInCompany } = parsed.data;

    // Already a member?
    const existingMember = await prisma.companyMember.findFirst({
      where: {
        companyId: user.activeCompanyId,
        user: {
          email,
        },
      },
      include: {
        user: true,
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: "This user is already a member of your company." },
        { status: 400 },
      );
    }

    // Already pending invite?
    const existingInvite = await prisma.companyInvite.findFirst({
      where: {
        companyId: user.activeCompanyId,
        email,
        status: InviteStatus.PENDING,
      },
    });

    if (existingInvite) {
      return NextResponse.json(
        { error: "An invite already exists for this email." },
        { status: 400 },
      );
    }

    const token = randomUUID();

    const invite = await prisma.companyInvite.create({
      data: {
        companyId: user.activeCompanyId,
        email,
        roleInCompany,
        invitedByUserId: user.id,
        token,
        status: InviteStatus.PENDING,
      },
    });

    // Frontend şu anda sadece "ok" olup olmadığıyla ilgileniyor
    // ama ileride kullanmak üzere invite'ı da geri döndürüyoruz.
    return NextResponse.json(
      {
        invite: {
          id: invite.id,
          email: invite.email,
          roleInCompany: invite.roleInCompany,
          status: invite.status,
          createdAt: invite.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[POST /api/customer/members/invite] error", error);
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
  }
}
