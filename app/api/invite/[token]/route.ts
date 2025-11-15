// -----------------------------------------------------------------------------
// @file: app/api/invite/[token]/route.ts
// @purpose: Public invite endpoint (view + accept company invite)
// @version: v1.1.0
// @status: active
// @lastUpdate: 2025-11-16
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { InviteStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getCurrentUserOrThrow } from "@/lib/auth";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

// -----------------------------------------------------------------------------
// GET /api/invite/:token
// Show invite details for the current viewer (does not require auth)
// -----------------------------------------------------------------------------
export async function GET(_req: NextRequest, context: RouteContext) {
  const { token } = await context.params; // ✅ BURASI ÖNEMLİ

  if (!token) {
    return NextResponse.json(
      { error: "Missing invite token in route params" },
      { status: 400 },
    );
  }

  try {
    const invite = await prisma.companyInvite.findUnique({
      where: { token },
      include: {
        company: true,
      },
    });

    if (!invite) {
      return NextResponse.json(
        { error: "Invite not found" },
        { status: 404 },
      );
    }

    const viewer = await getCurrentUser();

    let alreadyMember = false;

    if (viewer) {
      const member = await prisma.companyMember.findUnique({
        where: {
          companyId_userId: {
            companyId: invite.companyId,
            userId: viewer.id,
          },
        },
      });

      alreadyMember = !!member;
    }

    const canAccept =
      !!viewer &&
      invite.status === InviteStatus.PENDING &&
      !alreadyMember;

    return NextResponse.json(
      {
        invite: {
          id: invite.id,
          email: invite.email,
          roleInCompany: invite.roleInCompany,
          status: invite.status,
          createdAt: invite.createdAt.toISOString(),
        },
        company: {
          id: invite.company.id,
          name: invite.company.name,
          slug: invite.company.slug,
        },
        viewer: viewer
          ? {
              id: viewer.id,
              email: viewer.email,
              role: viewer.role,
              activeCompanyId: viewer.activeCompanyId,
            }
          : null,
        canAccept,
        alreadyMember,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[GET /api/invite/:token] error:", error);
    return NextResponse.json(
      { error: "Failed to load invite" },
      { status: 500 },
    );
  }
}

// -----------------------------------------------------------------------------
// POST /api/invite/:token
// Accept invite as current authenticated user (CUSTOMER)
// -----------------------------------------------------------------------------
export async function POST(_req: NextRequest, context: RouteContext) {
  const { token } = await context.params; // ✅ BURASI DA

  if (!token) {
    return NextResponse.json(
      { error: "Missing invite token in route params" },
      { status: 400 },
    );
  }

  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customer accounts can accept company invites" },
        { status: 403 },
      );
    }

    const invite = await prisma.companyInvite.findUnique({
      where: { token },
    });

    if (!invite) {
      return NextResponse.json(
        { error: "Invite not found" },
        { status: 404 },
      );
    }

    if (invite.status !== InviteStatus.PENDING) {
      return NextResponse.json(
        { error: "Only pending invites can be accepted" },
        { status: 400 },
      );
    }

    // Check if user is already a member of this company
    const existingMember = await prisma.companyMember.findUnique({
      where: {
        companyId_userId: {
          companyId: invite.companyId,
          userId: user.id,
        },
      },
    });

    let membershipId = existingMember?.id ?? null;

    // If not a member yet, create membership with invite role
    if (!existingMember) {
      const membership = await prisma.companyMember.create({
        data: {
          companyId: invite.companyId,
          userId: user.id,
          roleInCompany: invite.roleInCompany,
        },
      });
      membershipId = membership.id;
    }

    const updatedInvite = await prisma.companyInvite.update({
      where: { id: invite.id },
      data: {
        status: InviteStatus.ACCEPTED,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        invite: {
          id: updatedInvite.id,
          status: updatedInvite.status,
        },
        membershipId,
      },
      { status: 200 },
    );
  } catch (error: any) {
    if ((error as any)?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    console.error("[POST /api/invite/:token] error:", error);
    return NextResponse.json(
      { error: "Failed to accept invite" },
      { status: 500 },
    );
  }
}
