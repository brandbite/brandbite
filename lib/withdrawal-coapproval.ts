// -----------------------------------------------------------------------------
// @file: lib/withdrawal-coapproval.ts
// @purpose: 2-person approval on large withdrawals (Security Plan — L6).
//           Above `COAPPROVAL_THRESHOLD_TOKENS`, a single SITE_OWNER
//           approving a withdrawal is not enough to transition it. Two
//           distinct SITE_OWNERs must each click Approve (each still
//           completes L2 typed-phrase + L4 MFA). The first approval
//           records a WithdrawalApproval row; the second is what actually
//           flips the status.
//
//           Single-owner bypass: if the platform has only one SITE_OWNER,
//           the 2-person rule would freeze all large withdrawals. When
//           we detect `ownerCount <= 1`, we return "enough" immediately
//           (logged separately so it's visible).
// -----------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Tunables.
//
// 50,000 tokens ≈ $500 at our current token-cost assumptions. Numbers below
// this are small enough that a single compromised owner approving them
// alone is a bounded loss, measured against the workflow friction of
// requiring two signers on every payout. Pipe through AppSetting if you
// want admin-configurable in the future.
// ---------------------------------------------------------------------------

export const COAPPROVAL_THRESHOLD_TOKENS = 50_000;
export const REQUIRED_APPROVALS = 2;

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

export function requiresCoApproval(amountTokens: number): boolean {
  return amountTokens >= COAPPROVAL_THRESHOLD_TOKENS;
}

export type CoApprovalSnapshot = {
  requiredApprovals: number;
  currentApprovalCount: number;
  approverIds: string[];
  approverEmails: string[];
  thresholdTokens: number;
  ownerCount: number;
  /** True when we should proceed as if the 2-person rule is satisfied. */
  hasEnough: boolean;
  /** True when the rule was bypassed because only 1 owner exists. */
  bypassedSingleOwner: boolean;
};

/**
 * Load the current coapproval state for a withdrawal + decide whether the
 * 2-person rule is satisfied. The caller (the approve route) uses this
 * after recording its own approval to know whether to flip the status.
 */
export async function evaluateCoApproval(withdrawalId: string): Promise<CoApprovalSnapshot> {
  const [approvals, ownerCount] = await Promise.all([
    prisma.withdrawalApproval.findMany({
      where: { withdrawalId },
      include: {
        approver: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.userAccount.count({
      where: { role: "SITE_OWNER", deletedAt: null },
    }),
  ]);

  const count = approvals.length;
  const approverIds = approvals.map((a) => a.approverId);
  const approverEmails = approvals.map((a) => a.approver?.email ?? "(unknown)");

  // Single-owner bypass — with 0 or 1 SITE_OWNER the 2-person rule is
  // impossible to satisfy; we treat the rule as satisfied to avoid
  // freezing payouts. The caller should still record its approval row
  // for the paper trail.
  const bypassedSingleOwner = ownerCount <= 1;
  const hasEnough = bypassedSingleOwner || count >= REQUIRED_APPROVALS;

  return {
    requiredApprovals: REQUIRED_APPROVALS,
    currentApprovalCount: count,
    approverIds,
    approverEmails,
    thresholdTokens: COAPPROVAL_THRESHOLD_TOKENS,
    ownerCount,
    hasEnough,
    bypassedSingleOwner,
  };
}

/**
 * Check whether `approverId` has already signed this withdrawal. Used to
 * reject the "owner clicks approve twice" case with a clear error instead
 * of leaving a confusing silent no-op.
 */
export async function hasAlreadyApproved(
  withdrawalId: string,
  approverId: string,
): Promise<boolean> {
  const existing = await prisma.withdrawalApproval.findUnique({
    where: {
      withdrawalId_approverId: { withdrawalId, approverId },
    },
    select: { id: true },
  });
  return Boolean(existing);
}

type RecordApprovalInput = {
  withdrawalId: string;
  approverId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/**
 * Record the current approver's signature. Throws on unique-constraint
 * violation (you already approved) so the caller can translate to a 409.
 */
export async function recordApproval(input: RecordApprovalInput): Promise<void> {
  await prisma.withdrawalApproval.create({
    data: {
      withdrawalId: input.withdrawalId,
      approverId: input.approverId,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
