// -----------------------------------------------------------------------------
// @file: app/api/admin/users/[userId]/route.ts
// @purpose: Per-user detail aggregation for the admin user-profile drill-down.
//           Pulls everything an operator might want when investigating one
//           specific user — auth state (MFA, sessions), workload, ticket
//           counts, financial totals, audit history — in a single response
//           so the page renders without a half-dozen sub-fetches.
//
//           Read-only. Edits still go through the existing PATCH on the
//           list endpoint at /api/admin/users so the audit shape matches
//           what admins are already used to.
//
//           Auth: SITE_ADMIN+ (matches the list endpoint). Sensitive bits
//           still gate themselves further down — e.g. the audit-as-actor
//           list only renders meaningfully for admin role targets, and the
//           soft-deleted account view is shown rather than refused so
//           operators can still inspect a removed account's history.
// -----------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSiteAdminRole } from "@/lib/roles";

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

/** Current ISO week window (Monday 00:00 UTC → next Monday 00:00 UTC).
 *  Used for the "completed this week" stat. Intentionally UTC-aligned
 *  so different operators looking at the same account see the same
 *  number; the per-row caption in the analytics page already uses this
 *  same window. */
function currentWeekWindowUtc(): { start: number; end: number } {
  const now = new Date();
  const dow = now.getUTCDay(); // 0=Sun … 6=Sat
  const daysSinceMonday = (dow + 6) % 7;
  const start = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - daysSinceMonday,
  );
  return { start, end: start + 7 * 24 * 60 * 60 * 1000 };
}

// --------------------------------------------------------------------------
// GET — full user detail.
// --------------------------------------------------------------------------

export async function GET(_req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const caller = await getCurrentUserOrThrow();
    if (!isSiteAdminRole(caller.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { userId } = await params;
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    // ---- core user row ---------------------------------------------------
    const user = await prisma.userAccount.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        timezone: true,
        workingHours: true,
        tasksPerWeekCap: true,
        creativeRevisionNotesEnabled: true,
        isPaused: true,
        pausedAt: true,
        pauseExpiresAt: true,
        pauseType: true,
        totpEnrolledAt: true,
        authUserId: true,
      },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { start: weekStart, end: weekEnd } = currentWeekWindowUtc();

    // ---- parallel reads --------------------------------------------------
    // Most of the page is read-only aggregation; one Promise.all fans these
    // out so the worst case is one round-trip rather than seven.
    const [
      authUser,
      activeSessionCount,
      lastSession,
      adminActionsOnTarget,
      adminActionsAsActor,
      ticketsByStatus,
      completedThisWeek,
      ticketsCreatedCount,
      creativeSkills,
      earningsAgg,
      withdrawalsAgg,
      ratingAgg,
      companyMemberships,
      hiredFromApplication,
    ] = await Promise.all([
      // BetterAuth side: image + login-2FA flag + email verified + last
      // updated (proxy for last sign-in since BetterAuth bumps updatedAt
      // on session refresh).
      prisma.authUser.findUnique({
        where: { id: user.authUserId },
        select: {
          image: true,
          emailVerified: true,
          twoFactorEnabled: true,
          updatedAt: true,
        },
      }),
      prisma.authSession.count({
        where: { userId: user.authUserId, expiresAt: { gt: new Date() } },
      }),
      prisma.authSession.findFirst({
        where: { userId: user.authUserId, expiresAt: { gt: new Date() } },
        orderBy: { updatedAt: "desc" },
        select: { ipAddress: true, userAgent: true, updatedAt: true, createdAt: true },
      }),
      // Audit log entries WHERE this user is the target.
      prisma.adminActionLog.findMany({
        where: { targetType: "UserAccount", targetId: user.id },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          action: true,
          outcome: true,
          actorEmail: true,
          actorRole: true,
          metadata: true,
          errorMessage: true,
          createdAt: true,
        },
      }),
      // Audit log entries WHERE this user is the actor (only meaningful
      // for admin/owner role targets). We always query — keeps the API
      // shape stable — and the page hides the section for non-admin
      // targets so the empty array doesn't render an empty card.
      prisma.adminActionLog.findMany({
        where: { actorId: user.id },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          action: true,
          outcome: true,
          targetType: true,
          targetId: true,
          metadata: true,
          createdAt: true,
        },
      }),
      // Designer-only: ticket counts grouped by status. Skipped for
      // non-designers (groupBy with no matches returns []).
      user.role === "DESIGNER"
        ? prisma.ticket.groupBy({
            by: ["status"],
            where: { creativeId: user.id },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      user.role === "DESIGNER"
        ? prisma.ticket.count({
            where: {
              creativeId: user.id,
              status: "DONE",
              updatedAt: {
                gte: new Date(weekStart),
                lt: new Date(weekEnd),
              },
            },
          })
        : Promise.resolve(0),
      // Customer-only: tickets they created.
      user.role === "CUSTOMER"
        ? prisma.ticket.count({ where: { createdById: user.id } })
        : Promise.resolve(0),
      // Designer-only: skill list.
      user.role === "DESIGNER"
        ? prisma.creativeSkill.findMany({
            where: { creativeId: user.id },
            select: {
              jobType: { select: { id: true, name: true, categoryId: true } },
            },
          })
        : Promise.resolve([]),
      // Designer-only: earnings + balance.
      user.role === "DESIGNER"
        ? prisma.tokenLedger.aggregate({
            where: { userId: user.id, direction: "CREDIT" },
            _sum: { amount: true },
          })
        : Promise.resolve(null),
      user.role === "DESIGNER"
        ? prisma.withdrawal.aggregate({
            where: { creativeId: user.id },
            _sum: { amountTokens: true },
            _count: true,
          })
        : Promise.resolve(null),
      user.role === "DESIGNER"
        ? prisma.creativeRating.aggregate({
            where: { creativeId: user.id },
            _avg: { quality: true, communication: true, speed: true },
            _count: { _all: true },
          })
        : Promise.resolve(null),
      // Customer-only: company memberships with token balance + plan.
      user.role === "CUSTOMER"
        ? prisma.companyMember.findMany({
            where: { userId: user.id },
            select: {
              roleInCompany: true,
              createdAt: true,
              company: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  tokenBalance: true,
                  billingStatus: true,
                  plan: { select: { id: true, name: true, monthlyTokens: true } },
                },
              },
            },
          })
        : Promise.resolve([]),
      // Designer-only: link back to the talent application that hired them
      // (when they came in through that flow). Useful for "where did this
      // person come from" investigations.
      user.role === "DESIGNER"
        ? prisma.talentApplication.findFirst({
            where: { hiredUserAccountId: user.id },
            select: {
              id: true,
              fullName: true,
              hiredAt: true,
              hiredByUserEmail: true,
              hireNotes: true,
              workload: true,
              preferredTasksPerWeek: true,
            },
          })
        : Promise.resolve(null),
    ]);

    // ---- shape the response ---------------------------------------------
    const ticketCounts = (() => {
      const counts: Record<string, number> = {
        TODO: 0,
        IN_PROGRESS: 0,
        IN_REVIEW: 0,
        DONE: 0,
      };
      for (const row of ticketsByStatus) {
        counts[row.status] = row._count._all;
      }
      const active = counts.TODO + counts.IN_PROGRESS + counts.IN_REVIEW;
      return {
        TODO: counts.TODO,
        IN_PROGRESS: counts.IN_PROGRESS,
        IN_REVIEW: counts.IN_REVIEW,
        DONE: counts.DONE,
        active,
        completedThisWeek,
      };
    })();

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        deletedAt: user.deletedAt ? user.deletedAt.toISOString() : null,
        timezone: user.timezone,
        workingHours: user.workingHours,
        tasksPerWeekCap: user.tasksPerWeekCap,
        creativeRevisionNotesEnabled: user.creativeRevisionNotesEnabled,
        isPaused: user.isPaused,
        pausedAt: user.pausedAt ? user.pausedAt.toISOString() : null,
        pauseExpiresAt: user.pauseExpiresAt ? user.pauseExpiresAt.toISOString() : null,
        pauseType: user.pauseType,
        totpEnrolledAt: user.totpEnrolledAt ? user.totpEnrolledAt.toISOString() : null,
        // Auth side
        image: authUser?.image ?? null,
        emailVerified: !!authUser?.emailVerified,
        twoFactorEnabled: !!authUser?.twoFactorEnabled,
        lastAuthActivityAt: authUser?.updatedAt ? new Date(authUser.updatedAt).toISOString() : null,
      },
      sessions: {
        activeCount: activeSessionCount,
        lastSession: lastSession
          ? {
              ipAddress: lastSession.ipAddress,
              userAgent: lastSession.userAgent,
              updatedAt: lastSession.updatedAt.toISOString(),
              createdAt: lastSession.createdAt.toISOString(),
            }
          : null,
      },
      audit: {
        // Actions performed ON this user (e.g. role change, hard-delete).
        asTarget: adminActionsOnTarget.map((row) => ({
          id: row.id,
          action: row.action,
          outcome: row.outcome,
          actorEmail: row.actorEmail,
          actorRole: row.actorRole,
          metadata: row.metadata,
          errorMessage: row.errorMessage,
          createdAt: row.createdAt.toISOString(),
        })),
        // Actions THIS user performed as an admin actor.
        asActor: adminActionsAsActor.map((row) => ({
          id: row.id,
          action: row.action,
          outcome: row.outcome,
          targetType: row.targetType,
          targetId: row.targetId,
          metadata: row.metadata,
          createdAt: row.createdAt.toISOString(),
        })),
      },
      // Designer-only sections; serialize as nulls when N/A so the
      // client can do `if (data.designer)` checks without role
      // string-matching twice.
      designer:
        user.role === "DESIGNER"
          ? {
              tickets: ticketCounts,
              skills: creativeSkills.map((s) => ({
                jobTypeId: s.jobType.id,
                jobTypeName: s.jobType.name,
                categoryId: s.jobType.categoryId,
              })),
              earnings: {
                totalEarned: earningsAgg?._sum.amount ?? 0,
                totalWithdrawn: withdrawalsAgg?._sum.amountTokens ?? 0,
                withdrawalCount: withdrawalsAgg?._count ?? 0,
              },
              ratings: ratingAgg
                ? {
                    count: ratingAgg._count._all,
                    quality: ratingAgg._avg.quality,
                    communication: ratingAgg._avg.communication,
                    speed: ratingAgg._avg.speed,
                  }
                : { count: 0, quality: null, communication: null, speed: null },
              hiredFrom: hiredFromApplication
                ? {
                    applicationId: hiredFromApplication.id,
                    fullName: hiredFromApplication.fullName,
                    hiredAt: hiredFromApplication.hiredAt
                      ? hiredFromApplication.hiredAt.toISOString()
                      : null,
                    hiredByUserEmail: hiredFromApplication.hiredByUserEmail,
                    hireNotes: hiredFromApplication.hireNotes,
                    workload: hiredFromApplication.workload,
                    preferredTasksPerWeek: hiredFromApplication.preferredTasksPerWeek,
                  }
                : null,
            }
          : null,
      customer:
        user.role === "CUSTOMER"
          ? {
              ticketsCreated: ticketsCreatedCount,
              memberships: companyMemberships.map((m) => ({
                roleInCompany: m.roleInCompany,
                joinedAt: m.createdAt.toISOString(),
                company: {
                  id: m.company.id,
                  name: m.company.name,
                  slug: m.company.slug,
                  tokenBalance: m.company.tokenBalance,
                  billingStatus: m.company.billingStatus,
                  plan: m.company.plan
                    ? {
                        id: m.company.plan.id,
                        name: m.company.plan.name,
                        monthlyTokens: m.company.plan.monthlyTokens,
                      }
                    : null,
                },
              })),
            }
          : null,
    });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[GET /api/admin/users/[userId]] error", err);
    return NextResponse.json({ error: "Failed to load user" }, { status: 500 });
  }
}
