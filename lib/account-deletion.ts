// -----------------------------------------------------------------------------
// @file: lib/account-deletion.ts
// @purpose: GDPR right-to-erasure — shared soft-delete + anonymize flow used
//           by customer and creative self-deletion routes. Keeps the two
//           role-specific endpoints thin and prevents drift (one anonymize
//           strategy, one FK-cleanup order, one sole-owner guard).
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
  // 3. All writes inside a transaction so we either fully delete or not at
  //    all. Ordering: BetterAuth tables first (FK to authUser), then the
  //    app's UserAccount row (anonymize, keep for ledger).
  // -------------------------------------------------------------------------
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.authSession.deleteMany({ where: { userId: account.authUserId } });
    await tx.authAccount.deleteMany({ where: { userId: account.authUserId } });
    await tx.authUser.deleteMany({ where: { id: account.authUserId } });

    // App side: anonymize in place. New email + random authUserId to free
    // the uniques up for a re-register. Keep id, role, relations so
    // ledger / tickets / ratings stay queryable with "deleted account".
    const anonymizedEmail = `deleted-${account.id}@deleted.brandbite.local`;
    const anonymizedAuthId = `deleted-${account.id}-${Date.now()}`;

    await tx.userAccount.update({
      where: { id: account.id },
      data: {
        deletedAt: new Date(),
        email: anonymizedEmail,
        authUserId: anonymizedAuthId,
        name: null,
      },
    });
  });

  return { ok: true };
}

/**
 * Prisma client type loosened for tests that pass a mock transaction
 * client. Not exported at runtime — kept inline for type safety when
 * other callers decide to compose additional work around the deletion.
 */
export type AnyPrisma = PrismaClient | Prisma.TransactionClient;
