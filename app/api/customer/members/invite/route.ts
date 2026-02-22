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
import { sendNotificationEmail } from "@/lib/email";

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

    const [invite, company] = await Promise.all([
      prisma.companyInvite.create({
        data: {
          companyId: user.activeCompanyId,
          email,
          roleInCompany,
          invitedByUserId: user.id,
          token,
          status: InviteStatus.PENDING,
        },
      }),
      prisma.company.findUnique({
        where: { id: user.activeCompanyId },
        select: { name: true },
      }),
    ]);

    // Send invite email (fire-and-forget)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteUrl = `${baseUrl}/invite/${token}`;
    const companyName = company?.name || "a team";
    const inviterName = user.name || user.email;

    sendNotificationEmail(
      email,
      `You've been invited to join ${companyName} on Brandbite`,
      [
        "<div style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto;\">",
        '<div style="background: #f15b2b; padding: 20px 24px; border-radius: 12px 12px 0 0;">',
        '<span style="font-size: 20px; font-weight: 700; color: #fff;">brandbite</span>',
        "</div>",
        '<div style="background: #fff; padding: 28px 24px; border: 1px solid #e3e1dc; border-top: none;">',
        `<p style="margin: 0 0 16px; font-size: 14px; color: #424143;">Hi,</p>`,
        `<p style="margin: 0 0 16px; font-size: 14px; color: #424143;"><strong>${inviterName}</strong> has invited you to join <strong>${companyName}</strong> on Brandbite as a ${roleInCompany.toLowerCase()}.</p>`,
        '<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;">',
        "<tr>",
        '<td style="border-radius: 8px; background: #f15b2b;">',
        `<a href="${inviteUrl}" target="_blank" style="display: inline-block; padding: 12px 28px; font-size: 14px; font-weight: 600; color: #fff; text-decoration: none; border-radius: 8px;">Accept Invite</a>`,
        "</td>",
        "</tr>",
        "</table>",
        '<p style="margin: 0; font-size: 13px; color: #7a7a7a;">If you weren\'t expecting this invitation, you can safely ignore this email.</p>',
        "</div>",
        '<div style="background: #faf9f7; padding: 16px 24px; border-radius: 0 0 12px 12px; border: 1px solid #e3e1dc; border-top: none;">',
        '<p style="margin: 0; font-size: 11px; color: #9a9892; text-align: center;">Brandbite &mdash; Creative-as-a-service platform</p>',
        "</div>",
        "</div>",
      ].join("\n"),
    );

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
