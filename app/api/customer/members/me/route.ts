// -----------------------------------------------------------------------------
// @file: app/api/customer/members/me/route.ts
// @purpose: Self-leave a company workspace (softer alternative to account
//           deletion for team members). Severs the caller's CompanyMember
//           row on their active company without touching the UserAccount.
//
//           Guards, in order:
//           - Role must be CUSTOMER (site admins + creatives have no
//             CompanyMember row here; this would no-op at best).
//           - Caller must have an active company.
//           - Caller must actually be a member of that company.
//           - If caller is the sole OWNER of the company, block the leave
//             — they must either transfer ownership first (promote another
//             member to OWNER) or delete the company. Matches the same
//             guard in /api/customer/members/[memberId] DELETE.
//
//           On success: client re-fetches /api/session and /api/customer/*
//           data; if the user still has another company they'll be
//           switched to it, otherwise they land on onboarding.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";

export async function DELETE(_req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customer accounts can leave a workspace this way." },
        { status: 403 },
      );
    }

    if (!user.activeCompanyId) {
      return NextResponse.json({ error: "No active company selected." }, { status: 400 });
    }

    const membership = await prisma.companyMember.findUnique({
      where: {
        companyId_userId: {
          companyId: user.activeCompanyId,
          userId: user.id,
        },
      },
      select: { id: true, roleInCompany: true, companyId: true },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "You are not a member of this workspace." },
        { status: 404 },
      );
    }

    // Sole-OWNER guard — prevent a user from orphaning the workspace.
    if (membership.roleInCompany === "OWNER") {
      const ownersCount = await prisma.companyMember.count({
        where: { companyId: membership.companyId, roleInCompany: "OWNER" },
      });
      if (ownersCount <= 1) {
        return NextResponse.json(
          {
            error:
              "You are the only owner of this workspace. Promote another member to Owner first, or delete the workspace.",
          },
          { status: 409 },
        );
      }
    }

    await prisma.companyMember.delete({
      where: { id: membership.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[customer/members/me] DELETE error", error);
    return NextResponse.json({ error: "Failed to leave workspace." }, { status: 500 });
  }
}
