// -----------------------------------------------------------------------------
// @file: lib/account-deletion.ts
// @purpose: GDPR right-to-erasure — shared soft-delete + anonymize flow used
//           by customer and creative self-deletion routes AND the admin-
//           initiated USER_HARD_DELETE action. Keeps the call sites thin and
//           prevents drift (one anonymize strategy, one FK-cleanup order, one
//           sole-owner guard).
//
//           Behaviour (must match /privacy text):
//           - Hard-delete BetterAuth rows (sessions, accounts, user) so the
//             email is freed for re-registration.
//           - Soft-delete the UserAccount: deletedAt=now, email +
//             authUserId rewritten to unique "deleted-*" tokens, name=null.
//             Ledger entries, tickets, ratings etc. are intentionally kept
//             — they are financial/audit records and contain no direct PII
//             once the identity row is anonymized.
//           - lib/auth.ts rejects users with deletedAt != null as a belt-
//             and-suspenders check in case a stale session slips through.
//
// -----------------------------------------------------------------------------

import type { Prisma, PrismaClient, UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type AccountDeletionResult = { ok: true } | { ok: false; status: number; error: string };

type DeleteOwnAccountParams = {
  /** The authenticated user's UserAccount id. */
  userId: string;
  /** The caller's own email, from the session — used for the confirm-match. */
  sessionEmail: string;
  /** The role the caller is expected to have (route-level sanity check). */
  expectedRole: UserRole;
  /** Email echoed back from the confirmation modal. */
  confirmEmail: string | undefined;
};

/**
 * Execute a GDPR delete for the caller's own account. The caller is
 * responsible for:
 *  - authenticating the request (getCurrentUserOrThrow)
 *  - checking the caller's role matches the expected role for the route
 *  - dropping auth cookies on the response
 *
 * This helper does the DB work only, and the role pre-check as a
 * belt-and-suspenders defence in case a route gets re-pointed by accident.
 */
export async function deleteOwnAccount(
  params: DeleteOwnAccountParams,
): Promise<AccountDeletionResult> {
  const { userId, sessionEmail, expectedRole, confirmEmail } = params;

  // -------------------------------------------------------------------------
  // 1. Email confirmation must match — the UI forces this too, but we
  //    double-check server-side so curl against the API can't skip it.
  // -------------------------------------------------------------------------
  if (!confirmEmail || confirmEmail.trim().toLowerCase() !== sessionEmail.toLowerCase()) {
    return {
      ok: false,
      status: 400,
      error:
        "Confirmation email did not match the account email. Type your exact email to confirm.",
    };
  }

  // -------------------------------------------------------------------------
  // 2. Load the account. 404 if we somehow lost it between session resolve
  //    and here. 400 if it's already soft-deleted.
  // -------------------------------------------------------------------------
  const account = await prisma.userAccount.findUnique({
    where: { id: userId },
    select: {
      id: true,
      authUserId: true,
      email: true,
      role: true,
      deletedAt: true,
    },
  });

  if (!account) {
    return { ok: false, status: 404, error: "Account not found." };
  }

  if (account.deletedAt) {
    return { ok: false, status: 400, error: "Account is already deleted." };
  }

  // Role sanity check. If this fails the route wiring is wrong — a customer
  // route must only run for CUSTOMER, a creative route only for DESIGNER.
  if (account.role !== expectedRole) {
    return {
      ok: false,
      status: 403,
      error: "This deletion endpoint does not apply to your account role.",
    };
  }

  // -------------------------------------------------------------------------
  // 3. Things the account still holds that deleting would strand. Self-
  //    delete only — the admin USER_HARD_DELETE flow decides for itself.
  // -------------------------------------------------------------------------
  const blocker = await findSelfDeletionBlocker(account.id, account.role);
  if (blocker) {
    return { ok: false, status: 409, error: blocker };
  }

  // -------------------------------------------------------------------------
  // 4. Anonymize via the shared helper so self-delete and admin-delete
  //    can never drift on FK cleanup order or anonymization shape.
  // -------------------------------------------------------------------------
  await applyAccountAnonymization({
    accountId: account.id,
    authUserId: account.authUserId,
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Self-deletion blockers
// ---------------------------------------------------------------------------

const OPEN_TICKET_STATUSES = ["TODO", "IN_PROGRESS", "IN_REVIEW"] as const;
const IN_FLIGHT_WITHDRAWAL_STATUSES = ["PENDING", "APPROVED"] as const;

/**
 * Returns a user-facing reason the account can't delete itself yet, or null.
 * Deletion stays possible in every case once the blocker is cleared — this
 * never takes away the right to erasure, it only stops people stranding
 * others (an ownerless company) or work and money in flight.
 *
 * - CUSTOMER: the only (non-deleted) OWNER of a company that still has other
 *   active members must hand ownership over first. A sole member may delete.
 * - DESIGNER: open assigned tickets, or withdrawals still pending/approved.
 *
 * Memberships survive anonymization, so "other owner/member" means another
 * non-deleted UserAccount.
 */
export async function findSelfDeletionBlocker(
  accountId: string,
  role: UserRole,
  db: Pick<PrismaClient, "companyMember" | "ticket" | "withdrawal"> = prisma,
): Promise<string | null> {
  if (role === "CUSTOMER") {
    const owned = await db.companyMember.findMany({
      where: { userId: accountId, roleInCompany: "OWNER" },
      select: { companyId: true, company: { select: { name: true } } },
    });
    for (const m of owned) {
      const others = await db.companyMember.findMany({
        where: { companyId: m.companyId, userId: { not: accountId }, user: { deletedAt: null } },
        select: { roleInCompany: true },
      });
      const hasOtherOwner = others.some((o) => o.roleInCompany === "OWNER");
      if (others.length > 0 && !hasOtherOwner) {
        return `You're the only Owner of ${m.company.name}. Make another member an Owner on the Members page before deleting your account.`;
      }
    }
    return null;
  }

  if (role === "DESIGNER") {
    const openTickets = await db.ticket.count({
      where: { creativeId: accountId, status: { in: [...OPEN_TICKET_STATUSES] } },
    });
    if (openTickets > 0) {
      return `You still have ${openTickets} open job${openTickets === 1 ? "" : "s"} assigned to you. Finish ${openTickets === 1 ? "it" : "them"}, or contact us so we can reassign ${openTickets === 1 ? "it" : "them"}, before deleting your account.`;
    }
    const inFlight = await db.withdrawal.count({
      where: { creativeId: accountId, status: { in: [...IN_FLIGHT_WITHDRAWAL_STATUSES] } },
    });
    if (inFlight > 0) {
      return "You have a withdrawal that hasn't been paid yet. Wait until it's paid, or cancel it if it's still pending, before deleting your account.";
    }
    return null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Shared anonymize transaction
// ---------------------------------------------------------------------------

type ApplyAnonymizationParams = {
  accountId: string;
  authUserId: string;
};

/**
 * The actual anonymize transaction — split out so the admin-initiated
 * USER_HARD_DELETE flow at /api/admin/users can run the same writes
 * without duplicating the FK cleanup ordering. Caller is responsible
 * for any prior validation (already-deleted, role, confirmation, MFA).
 *
 * Ordering: BetterAuth tables first (FK to authUser), then the app's
 * UserAccount row (anonymize, keep for ledger).
 */
export async function applyAccountAnonymization(params: ApplyAnonymizationParams): Promise<void> {
  const { accountId, authUserId } = params;

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.authSession.deleteMany({ where: { userId: authUserId } });
    await tx.authAccount.deleteMany({ where: { userId: authUserId } });
    await tx.authUser.deleteMany({ where: { id: authUserId } });

    // App side: anonymize in place. New email + random authUserId to free
    // the uniques up for a re-register. Keep id, role, relations so
    // ledger / tickets / ratings stay queryable with "deleted account".
    const anonymizedEmail = `deleted-${accountId}@deleted.brandbite.local`;
    const anonymizedAuthId = `deleted-${accountId}-${Date.now()}`;

    await tx.userAccount.update({
      where: { id: accountId },
      data: {
        deletedAt: new Date(),
        email: anonymizedEmail,
        authUserId: anonymizedAuthId,
        name: null,
      },
    });
  });
}

/**
 * Prisma client type loosened for tests that pass a mock transaction
 * client. Not exported at runtime — kept inline for type safety when
 * other callers decide to compose additional work around the deletion.
 */
export type AnyPrisma = PrismaClient | Prisma.TransactionClient;
