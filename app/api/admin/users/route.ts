// -----------------------------------------------------------------------------
// @file: app/api/admin/users/route.ts
// @purpose: List all platform users with optional filtering by role and search
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { extractAuditContext, logAdminAction } from "@/lib/admin-audit";
import { CONFIRMATION_PHRASES, checkConfirmationPhrase } from "@/lib/admin-confirmation";
import { canPromoteToSiteAdmin, isSiteAdminRole } from "@/lib/roles";
import { AdminActionType, UserRole, Prisma } from "@prisma/client";

const VALID_ROLES: string[] = ["SITE_OWNER", "SITE_ADMIN", "DESIGNER", "CUSTOMER"];

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const roleFilter = searchParams.get("role");
    const search = searchParams.get("q")?.trim() || "";

    const where: Prisma.UserAccountWhereInput = {};

    if (roleFilter && VALID_ROLES.includes(roleFilter)) {
      where.role = roleFilter as UserRole;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const users = await prisma.userAccount.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        isPaused: true,
        creativeRevisionNotesEnabled: true,
        _count: {
          select: {
            companies: true,
            creativeTickets: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        createdAt: u.createdAt.toISOString(),
        isPaused: u.isPaused,
        creativeRevisionNotesEnabled: u.creativeRevisionNotesEnabled,
        companyCount: u._count.companies,
        assignedTickets: u._count.creativeTickets,
      })),
    });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[GET /api/admin/users] error", error);
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    if (!isSiteAdminRole(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { userId, role, creativeRevisionNotesEnabled, confirmation } = body as {
      userId?: string;
      role?: string;
      creativeRevisionNotesEnabled?: boolean;
      confirmation?: string;
    };

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const target = await prisma.userAccount.findUnique({ where: { id: userId } });
    if (!target) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // Toggle creativeRevisionNotesEnabled (designer only)
    if (typeof creativeRevisionNotesEnabled === "boolean") {
      if (target.role !== "DESIGNER") {
        return NextResponse.json(
          { error: "Revision notes toggle only applies to creatives." },
          { status: 400 },
        );
      }

      const updated = await prisma.userAccount.update({
        where: { id: userId },
        data: { creativeRevisionNotesEnabled },
        select: { id: true, creativeRevisionNotesEnabled: true },
      });

      return NextResponse.json({ user: updated });
    }

    // Role change
    if (!role || !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` },
        { status: 400 },
      );
    }

    // Prevent changing own role
    if (userId === user.id) {
      return NextResponse.json({ error: "You cannot change your own role." }, { status: 400 });
    }

    const auditCtx = extractAuditContext(req);

    // Role escalation guard — only SITE_OWNER can hand out admin roles
    // or demote an existing SITE_OWNER. SITE_ADMIN can still change
    // CUSTOMER / DESIGNER roles (helping customers, managing creatives).
    if (role === "SITE_OWNER" || role === "SITE_ADMIN") {
      if (!canPromoteToSiteAdmin(user.role)) {
        await logAdminAction({
          actor: user,
          action: AdminActionType.USER_PROMOTE_TO_ADMIN,
          outcome: "BLOCKED",
          targetType: "UserAccount",
          targetId: target.id,
          metadata: { attemptedRole: role, targetEmail: target.email },
          errorMessage: "Only site owners can assign admin roles.",
          context: auditCtx,
        });
        return NextResponse.json(
          { error: "Only site owners can assign admin roles." },
          { status: 403 },
        );
      }
    }

    if (target.role === "SITE_OWNER" && !canPromoteToSiteAdmin(user.role)) {
      await logAdminAction({
        actor: user,
        action: AdminActionType.USER_PROMOTE_TO_ADMIN,
        outcome: "BLOCKED",
        targetType: "UserAccount",
        targetId: target.id,
        metadata: {
          attemptedRole: role,
          targetEmail: target.email,
          targetCurrentRole: target.role,
        },
        errorMessage: "Only site owners can modify another site owner's role.",
        context: auditCtx,
      });
      return NextResponse.json(
        { error: "Only site owners can modify another site owner's role." },
        { status: 403 },
      );
    }

    // Typed-phrase confirmation when this is actually a privilege change
    // (new role is an admin role, or target is currently SITE_OWNER). Other
    // role changes — CUSTOMER <-> DESIGNER for example — don't require
    // confirmation because they're not privilege-escalation events.
    const isPrivilegeChange =
      role === "SITE_OWNER" || role === "SITE_ADMIN" || target.role === "SITE_OWNER";
    if (isPrivilegeChange) {
      const phraseCheck = checkConfirmationPhrase(
        confirmation,
        CONFIRMATION_PHRASES.USER_PROMOTE_TO_ADMIN,
      );
      if (!phraseCheck.ok) {
        await logAdminAction({
          actor: user,
          action: AdminActionType.USER_PROMOTE_TO_ADMIN,
          outcome: "BLOCKED",
          targetType: "UserAccount",
          targetId: target.id,
          metadata: {
            attemptedRole: role,
            targetEmail: target.email,
            targetCurrentRole: target.role,
          },
          errorMessage: phraseCheck.error,
          context: auditCtx,
        });
        return NextResponse.json({ error: phraseCheck.error }, { status: 400 });
      }
    }

    const updated = await prisma.userAccount.update({
      where: { id: userId },
      data: { role: role as UserRole },
      select: { id: true, email: true, name: true, role: true },
    });

    // Only log a role change to SITE_OWNER / SITE_ADMIN under the
    // PROMOTE_TO_ADMIN event — changing a CUSTOMER to DESIGNER is not a
    // privilege-escalation event and shouldn't clutter the log.
    if (role === "SITE_OWNER" || role === "SITE_ADMIN" || target.role === "SITE_OWNER") {
      await logAdminAction({
        actor: user,
        action: AdminActionType.USER_PROMOTE_TO_ADMIN,
        outcome: "SUCCESS",
        targetType: "UserAccount",
        targetId: updated.id,
        metadata: {
          targetEmail: updated.email,
          previousRole: target.role,
          newRole: updated.role,
        },
        context: auditCtx,
      });
    }

    return NextResponse.json({ user: updated });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[PATCH /api/admin/users] error", error);
    return NextResponse.json({ error: "Failed to update user role" }, { status: 500 });
  }
}
