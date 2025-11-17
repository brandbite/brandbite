// -----------------------------------------------------------------------------
// @file: app/api/customer/members/route.ts
// @purpose: Customer API for viewing company members & roles + pending invites
// @version: v1.2.0
// @status: active
// @lastUpdate: 2025-11-17
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import {
  canManageMembers,
  normalizeCompanyRole,
} from "@/lib/permissions/companyRoles";

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    // Sadece CUSTOMER kullanıcılar company members görebilir
    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customer users can access members." },
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

    // OWNER + PM dışındakiler için members erişimi yok
    if (!canManageMembers(companyRole)) {
      return NextResponse.json(
        {
          error:
            "Only company owners or project managers may view and manage members and invites for this workspace.",
        },
        { status: 403 },
      );
    }

    const companyId = user.activeCompanyId;

    const [company, memberRows, inviteRows] = await Promise.all([
      prisma.company.findUnique({
        where: { id: companyId },
        select: {
          id: true,
          name: true,
          slug: true,
        },
      }),

      prisma.companyMember.findMany({
        where: { companyId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      }),

      prisma.companyInvite.findMany({
        where: {
          companyId,
          status: "PENDING",
        },
        include: {
          invitedByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      }),
    ]);

    if (!company) {
      return NextResponse.json(
        { error: "Company not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        company: {
          id: company.id,
          name: company.name,
          slug: company.slug,
        },
        currentUserId: user.id,
        members: memberRows.map((m) => ({
          id: m.id,
          userId: m.user.id,
          name: m.user.name,
          email: m.user.email,
          roleInCompany: m.roleInCompany,
          joinedAt: m.createdAt.toISOString(),
        })),
        pendingInvites: inviteRows.map((inv) => ({
          id: inv.id,
          email: inv.email,
          roleInCompany: inv.roleInCompany,
          status: inv.status,
          createdAt: inv.createdAt.toISOString(),
          invitedByName: inv.invitedByUser?.name ?? null,
          invitedByEmail: inv.invitedByUser?.email ?? null,
        })),
      },
      { status: 200 },
    );
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 },
      );
    }

    console.error("[customer.members] GET error", error);
    return NextResponse.json(
      { error: "Failed to load company members" },
      { status: 500 },
    );
  }
}
