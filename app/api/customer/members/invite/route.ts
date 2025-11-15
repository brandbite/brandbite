// -----------------------------------------------------------------------------
// @file: app/api/customer/members/invite/route.ts
// @purpose: Create a company invite (email + role) for current customer's company
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-16
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CompanyRole, InviteStatus } from "@prisma/client";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { randomUUID } from "crypto";

const ALLOWED_INVITER_ROLES: CompanyRole[] = ["OWNER", "PM"];
const ALLOWED_ASSIGNED_ROLES: CompanyRole[] = ["MEMBER", "PM", "BILLING"];

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (user.role !== "CUSTOMER") {
      return NextResponse.json(
        { error: "Only customers can create company invites" },
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
      !ALLOWED_INVITER_ROLES.includes(user.companyRole as CompanyRole)
    ) {
      return NextResponse.json(
        {
          error:
            "Only company owners or project managers can invite new members",
        },
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

    const rawEmail = String((body as any).email ?? "").trim().toLowerCase();
    const rawRole = String((body as any).roleInCompany ?? "").trim();

    if (!rawEmail) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 },
      );
    }

    // basit bir email check (regex manyaklığına gerek yok)
    if (!rawEmail.includes("@") || !rawEmail.includes(".")) {
      return NextResponse.json(
        { error: "Please provide a valid email address" },
        { status: 400 },
      );
    }

    const roleInCompany: CompanyRole = ALLOWED_ASSIGNED_ROLES.includes(
      rawRole as CompanyRole,
    )
      ? (rawRole as CompanyRole)
      : "MEMBER";

    // 1) eğer user zaten varsa ve aynı company'ye üyeyse, invite gerek yok
    const existingUser = await prisma.userAccount.findUnique({
      where: { email: rawEmail },
      select: { id: true },
    });

    if (existingUser) {
      const existingMember = await prisma.companyMember.findUnique({
        where: {
          companyId_userId: {
            companyId: user.activeCompanyId,
            userId: existingUser.id,
          },
        },
      });

      if (existingMember) {
        return NextResponse.json(
          { error: "This user is already a member of your company" },
          { status: 400 },
        );
      }
    }

    // 2) aynı email için PENDING invite var mı?
    const existingInvite = await prisma.companyInvite.findFirst({
      where: {
        companyId: user.activeCompanyId,
        email: rawEmail,
        status: InviteStatus.PENDING,
      },
    });

    if (existingInvite) {
      return NextResponse.json(
        { error: "There is already a pending invite for this email" },
        { status: 400 },
      );
    }

    const token = randomUUID();

    const invite = await prisma.companyInvite.create({
      data: {
        companyId: user.activeCompanyId,
        email: rawEmail,
        roleInCompany,
        invitedByUserId: user.id,
        token,
        status: InviteStatus.PENDING,
      },
    });

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

    console.error("[POST /api/customer/members/invite] error:", error);
    return NextResponse.json(
      { error: "Failed to create invite" },
      { status: 500 },
    );
  }
}
