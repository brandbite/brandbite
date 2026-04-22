// -----------------------------------------------------------------------------
// @file: lib/admin-audit.ts
// @purpose: Write-only admin action audit log (Security Precaution Plan — L1).
//           Every privileged action — withdrawal approvals, plan edits, token
//           grants, pricing changes, role promotions — writes a row here so we
//           have a forensic trail for compromise investigation, legal dispute,
//           and regulatory audit.
//
//           Design notes:
//             - Writes must not throw. If the DB is having a bad day we still
//               want the action to complete (or fail naturally) — we don't want
//               a degraded audit log to block real work. Errors are console-
//               warned instead of raised.
//             - Actor identity is snapshotted (email + role) because the actor's
//               UserAccount row can anonymize later (GDPR delete) or change
//               role. The log must show who did what *at the time of the
//               action*, not who the actor is today.
//             - Outcome ("SUCCESS" / "BLOCKED" / "ERROR") is a separate column
//               rather than inferred from presence of errorMessage, because
//               "BLOCKED" (e.g. the 403 from canApproveWithdrawals returning
//               false) is a recon signal — future L5 email-on-blocked alerts
//               query it directly.
// -----------------------------------------------------------------------------

import type { NextRequest } from "next/server";
import type { AdminActionOutcome, AdminActionType, Prisma, UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/roles";
import { getClientIp } from "@/lib/rate-limit";
import { sendAdminActionBlockedAlert, sendAdminActionReceipt } from "@/lib/admin-action-email";

export type AdminAuditContext = {
  ipAddress: string | null;
  userAgent: string | null;
};

/**
 * Pull the IP + user-agent from a Next.js request. Safe to call with a
 * partial request (returns nulls). Keeps the call sites at the route
 * handler simple: `extractAuditContext(req)` and pass the result in.
 */
export function extractAuditContext(req: NextRequest | Request): AdminAuditContext {
  try {
    const headers = req.headers;
    const ip = getClientIp(headers) || null;
    const userAgent = headers.get("user-agent") || null;
    return { ipAddress: ip, userAgent };
  } catch {
    return { ipAddress: null, userAgent: null };
  }
}

type LogAdminActionInput = {
  /** The authenticated user performing the action. Typically from getCurrentUserOrThrow. */
  actor: Pick<SessionUser, "id" | "email" | "role">;
  action: AdminActionType;
  outcome: AdminActionOutcome;
  /** Payload specific to the action (amount, old→new values, target IDs). */
  metadata?: Prisma.InputJsonValue | null;
  /** The primary object the action touches, if any. */
  targetType?: string | null;
  targetId?: string | null;
  /** Populated when outcome is BLOCKED or ERROR. */
  errorMessage?: string | null;
  /** Request context (IP, user-agent). Call extractAuditContext(req) to build. */
  context?: AdminAuditContext;
};

/**
 * Record a privileged action. Never throws — errors are logged and
 * swallowed so that a broken audit log cannot block the action itself.
 * Call after the work is done (or after the guard blocks it).
 */
export async function logAdminAction(input: LogAdminActionInput): Promise<void> {
  const { actor, action, outcome, metadata, targetType, targetId, errorMessage, context } = input;

  const createdAt = new Date();

  try {
    await prisma.adminActionLog.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role as UserRole,
        action,
        outcome,
        metadata: metadata ?? undefined,
        targetType: targetType ?? null,
        targetId: targetId ?? null,
        errorMessage: errorMessage ?? null,
        ipAddress: context?.ipAddress ?? null,
        userAgent: context?.userAgent ?? null,
        createdAt,
      },
    });
  } catch (err) {
    // Non-fatal. The alternative is dropping user actions because we can't
    // write a log row, which is worse than a missing log entry.
    console.warn("[admin-audit] failed to write action log:", {
      action,
      actorId: actor.id,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  // L3 — email receipt on SUCCESS.
  // L5 — alert to SITE_OWNERs on BLOCKED from a non-owner actor.
  // Both are best-effort and non-throwing; both skipped in demo mode.
  // Run after the log write so recipients get a receipt for a row that
  // actually exists in the audit log. Failure here does NOT undo the log.
  const emailEntry = {
    actorEmail: actor.email,
    actorRole: actor.role as UserRole,
    action,
    outcome,
    metadata: metadata ?? null,
    targetType: targetType ?? null,
    targetId: targetId ?? null,
    ipAddress: context?.ipAddress ?? null,
    errorMessage: errorMessage ?? null,
    createdAt,
  };

  if (outcome === "SUCCESS") {
    await sendAdminActionReceipt(emailEntry);
  } else if (outcome === "BLOCKED") {
    await sendAdminActionBlockedAlert({ ...emailEntry, actorId: actor.id });
  }
}

/**
 * Convenience wrapper for the common "I already have a NextRequest,
 * give me the whole call" pattern. Avoids callers needing to import
 * extractAuditContext separately.
 */
export async function logAdminActionFromRequest(
  req: NextRequest | Request,
  input: Omit<LogAdminActionInput, "context">,
): Promise<void> {
  return logAdminAction({ ...input, context: extractAuditContext(req) });
}
