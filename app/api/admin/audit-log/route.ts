// -----------------------------------------------------------------------------
// @file: app/api/admin/audit-log/route.ts
// @purpose: SITE_OWNER-only read of the admin action audit log.
//
//           Read access is intentionally limited to SITE_OWNER (not SITE_ADMIN)
//           because the log captures BLOCKED attempts by admins trying to
//           escalate — an admin shouldn't be able to see the forensic record
//           of their own blocked-action attempts.
// -----------------------------------------------------------------------------

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import type { AdminActionOutcome, AdminActionType, Prisma } from "@prisma/client";

import { getCurrentUserOrThrow } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSiteOwnerRole } from "@/lib/roles";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

const VALID_OUTCOMES = new Set<AdminActionOutcome>(["SUCCESS", "BLOCKED", "ERROR"]);

const VALID_ACTIONS = new Set<AdminActionType>([
  "WITHDRAWAL_APPROVE",
  "WITHDRAWAL_MARK_PAID",
  "WITHDRAWAL_REJECT",
  "PLAN_CREATE",
  "PLAN_EDIT",
  "PLAN_DELETE",
  "PLAN_ASSIGN",
  "COMPANY_TOKEN_GRANT",
  "PAYOUT_RULE_EDIT",
  "TICKET_FINANCIAL_OVERRIDE",
  "USER_PROMOTE_TO_ADMIN",
  "USER_HARD_DELETE",
  "AI_PRICING_EDIT",
  "CONSULTATION_PRICING_EDIT",
  "GOOGLE_OAUTH_CONFIG_EDIT",
]);

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserOrThrow();

    if (!isSiteOwnerRole(user.role)) {
      return NextResponse.json(
        { error: "Only site owners can read the admin audit log." },
        { status: 403 },
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const outcome = url.searchParams.get("outcome");
    const actorId = url.searchParams.get("actorId");
    const targetType = url.searchParams.get("targetType");
    const targetId = url.searchParams.get("targetId");
    const limitParam = url.searchParams.get("limit");
    const offsetParam = url.searchParams.get("offset");

    const limit = Math.min(Math.max(parseInt(limitParam ?? "", 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const offset = Math.max(parseInt(offsetParam ?? "", 10) || 0, 0);

    const where: Prisma.AdminActionLogWhereInput = {};
    if (action && VALID_ACTIONS.has(action as AdminActionType)) {
      where.action = action as AdminActionType;
    }
    if (outcome && VALID_OUTCOMES.has(outcome as AdminActionOutcome)) {
      where.outcome = outcome as AdminActionOutcome;
    }
    if (actorId) where.actorId = actorId;
    if (targetType) where.targetType = targetType;
    if (targetId) where.targetId = targetId;

    const [entries, total] = await Promise.all([
      prisma.adminActionLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          actor: {
            select: { id: true, email: true, name: true, role: true },
          },
        },
      }),
      prisma.adminActionLog.count({ where }),
    ]);

    return NextResponse.json({
      entries: entries.map((e) => ({
        id: e.id,
        createdAt: e.createdAt.toISOString(),
        action: e.action,
        outcome: e.outcome,
        actor: {
          id: e.actorId,
          // Prefer the live UserAccount name/email when it's still readable;
          // fall back to the snapshot email on the log row when the actor
          // has been anonymized (deletedAt set, email rewritten).
          email: e.actorEmail,
          name: e.actor?.name ?? null,
          role: e.actorRole,
        },
        target: e.targetType && e.targetId ? { type: e.targetType, id: e.targetId } : null,
        metadata: e.metadata,
        errorMessage: e.errorMessage,
        ipAddress: e.ipAddress,
        userAgent: e.userAgent,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("[admin/audit-log] GET error", error);
    return NextResponse.json({ error: "Failed to load audit log" }, { status: 500 });
  }
}
