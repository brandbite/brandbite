// -----------------------------------------------------------------------------
// @file: app/api/admin/users/route.ts
// @purpose: List all platform users with optional filtering by role and search
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyAccountAnonymization } from "@/lib/account-deletion";
import { getCurrentUserOrThrow } from "@/lib/auth";
import { extractAuditContext, logAdminAction } from "@/lib/admin-audit";
import { CONFIRMATION_PHRASES, checkConfirmationPhrase } from "@/lib/admin-confirmation";
import { MFA_ACTION_TAG_MONEY, requireFreshMfa } from "@/lib/mfa";
import { canPromoteToSiteAdmin, isSiteAdminRole, isSiteOwnerRole } from "@/lib/roles";
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
        // PR11 — surface the per-creative cap so the admin row can render
        // and inline-edit it. Null = no cap (existing behavior).
        tasksPerWeekCap: true,
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
        tasksPerWeekCap: u.tasksPerWeekCap,
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
    const { userId, role, creativeRevisionNotesEnabled, tasksPerWeekCap, confirmation } = body as {
      userId?: string;
      role?: string;
      creativeRevisionNotesEnabled?: boolean;
      // PR11 — null clears the cap (no-limit), number sets it. The
      // discriminator below treats `undefined` as "this isn't a cap edit"
      // so a role-change PATCH doesn't accidentally clear the cap.
      tasksPerWeekCap?: number | null;
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

    // PR11 — set / clear tasksPerWeekCap (designer only). Same shape as
    // the revision-notes toggle: not MFA-gated, plain audit log, no
    // role-change side-effects. Null clears, number 1-40 sets.
    if (tasksPerWeekCap !== undefined) {
      if (target.role !== "DESIGNER") {
        return NextResponse.json(
          { error: "Tasks-per-week cap only applies to creatives." },
          { status: 400 },
        );
      }
      if (tasksPerWeekCap !== null) {
        if (
          typeof tasksPerWeekCap !== "number" ||
          !Number.isFinite(tasksPerWeekCap) ||
          !Number.isInteger(tasksPerWeekCap) ||
          tasksPerWeekCap < 1 ||
          tasksPerWeekCap > 40
        ) {
          return NextResponse.json(
            { error: "Tasks-per-week cap must be an integer between 1 and 40, or null." },
            { status: 400 },
          );
        }
      }

      const updated = await prisma.userAccount.update({
        where: { id: userId },
        data: { tasksPerWeekCap },
        select: { id: true, tasksPerWeekCap: true },
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

      // L4 — MFA required for privilege escalation too (same trust window
      // as money actions; once you've completed MFA for any MONEY_ACTION,
      // subsequent privilege changes in the next 30 min don't re-challenge).
      const mfa = await requireFreshMfa(user, MFA_ACTION_TAG_MONEY, {
        ipAddress: auditCtx.ipAddress,
        userAgent: auditCtx.userAgent,
      });
      if (!mfa.ok) return mfa.response;
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

// -----------------------------------------------------------------------------
// DELETE — admin-initiated USER_HARD_DELETE
//
// SITE_OWNER only. Re-uses the same anonymize-in-place transaction as the
// self-service GDPR delete (lib/account-deletion.ts) so we never drift on FK
// cleanup ordering. Gated by:
//   - Typed-phrase confirmation ("DELETE")
//   - Fresh MFA (MONEY_ACTION trust window — same as role escalation)
//   - "Cannot delete yourself" guard
//   - "Cannot delete another SITE_OWNER directly" guard — demote them
//     first via PATCH, then delete. Forces a two-step deliberate flow for
//     the most destructive transition.
//
// Audit log row is written for both BLOCKED and SUCCESS outcomes; the
// SITE_OWNER receipt email then fires automatically via the existing
// admin-action-email pipeline (USER_HARD_DELETE subject is already
// declared in lib/admin-action-email.ts).
// -----------------------------------------------------------------------------

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();
    if (!isSiteOwnerRole(user.role)) {
      return NextResponse.json(
        { error: "Only site owners can delete user accounts." },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);
    const { userId, confirmation } = (body ?? {}) as {
      userId?: string;
      confirmation?: string;
    };

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    if (userId === user.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account from here. Use account settings instead." },
        { status: 400 },
      );
    }

    const target = await prisma.userAccount.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        authUserId: true,
        deletedAt: true,
        _count: {
          select: {
            companies: true,
            creativeTickets: true,
          },
        },
      },
    });
    if (!target) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    if (target.deletedAt) {
      return NextResponse.json({ error: "User is already deleted." }, { status: 400 });
    }

    const auditCtx = extractAuditContext(req);

    // Refuse to delete another SITE_OWNER directly. Forces the operator to
    // demote them via PATCH first, which is itself MFA + typed-phrase
    // gated — so the destructive path is a deliberate two-step.
    if (isSiteOwnerRole(target.role)) {
      await logAdminAction({
        actor: user,
        action: AdminActionType.USER_HARD_DELETE,
        outcome: "BLOCKED",
        targetType: "UserAccount",
        targetId: target.id,
        metadata: { targetEmail: target.email, targetRole: target.role },
        errorMessage: "Demote the site owner to a lower role before deleting.",
        context: auditCtx,
      });
      return NextResponse.json(
        { error: "Demote the site owner to a lower role before deleting." },
        { status: 400 },
      );
    }

    // Typed-phrase confirmation. Mirrors the role-change flow.
    const phraseCheck = checkConfirmationPhrase(
      confirmation,
      CONFIRMATION_PHRASES.USER_HARD_DELETE,
    );
    if (!phraseCheck.ok) {
      await logAdminAction({
        actor: user,
        action: AdminActionType.USER_HARD_DELETE,
        outcome: "BLOCKED",
        targetType: "UserAccount",
        targetId: target.id,
        metadata: { targetEmail: target.email, targetRole: target.role },
        errorMessage: phraseCheck.error,
        context: auditCtx,
      });
      return NextResponse.json({ error: phraseCheck.error }, { status: 400 });
    }

    // Fresh MFA. Same trust window as money actions — once you've cleared
    // MFA for any MONEY_ACTION in the last 30 min, subsequent deletes
    // don't re-challenge.
    const mfa = await requireFreshMfa(user, MFA_ACTION_TAG_MONEY, {
      ipAddress: auditCtx.ipAddress,
      userAgent: auditCtx.userAgent,
    });
    if (!mfa.ok) return mfa.response;

    // Snapshot identity for the audit log BEFORE we anonymize, since the
    // anonymized row no longer carries the original email.
    const auditSnapshot = {
      targetEmail: target.email,
      targetRole: target.role,
      companyCount: target._count.companies,
      assignedTicketCount: target._count.creativeTickets,
    };

    try {
      await applyAccountAnonymization({
        accountId: target.id,
        authUserId: target.authUserId,
      });
    } catch (err) {
      console.error("[DELETE /api/admin/users] anonymization failed", err);
      await logAdminAction({
        actor: user,
        action: AdminActionType.USER_HARD_DELETE,
        outcome: "ERROR",
        targetType: "UserAccount",
        targetId: target.id,
        metadata: auditSnapshot,
        errorMessage: err instanceof Error ? err.message : "Anonymization transaction failed.",
        context: auditCtx,
      });
      return NextResponse.json({ error: "Failed to delete user." }, { status: 500 });
    }

    await logAdminAction({
      actor: user,
      action: AdminActionType.USER_HARD_DELETE,
      outcome: "SUCCESS",
      targetType: "UserAccount",
      targetId: target.id,
      metadata: auditSnapshot,
      context: auditCtx,
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[DELETE /api/admin/users] error", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
