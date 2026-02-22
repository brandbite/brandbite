// -----------------------------------------------------------------------------
// @file: app/api/admin/users/route.ts
// @purpose: List all platform users with optional filtering by role and search
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { isSiteAdminRole } from "@/lib/roles";
import { UserRole, Prisma } from "@prisma/client";

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
    const { userId, role, creativeRevisionNotesEnabled } = body as {
      userId?: string;
      role?: string;
      creativeRevisionNotesEnabled?: boolean;
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

    // Only SITE_OWNER can promote to SITE_OWNER or SITE_ADMIN
    if ((role === "SITE_OWNER" || role === "SITE_ADMIN") && user.role !== "SITE_OWNER") {
      return NextResponse.json(
        { error: "Only site owners can assign admin roles." },
        { status: 403 },
      );
    }

    // Prevent demoting a SITE_OWNER unless you're also a SITE_OWNER
    if (target.role === "SITE_OWNER" && user.role !== "SITE_OWNER") {
      return NextResponse.json(
        { error: "Only site owners can modify another site owner's role." },
        { status: 403 },
      );
    }

    const updated = await prisma.userAccount.update({
      where: { id: userId },
      data: { role: role as UserRole },
      select: { id: true, email: true, name: true, role: true },
    });

    return NextResponse.json({ user: updated });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[PATCH /api/admin/users] error", error);
    return NextResponse.json({ error: "Failed to update user role" }, { status: 500 });
  }
}
