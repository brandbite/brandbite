// -----------------------------------------------------------------------------
// @file: tests/integration/withdrawal-payout.test.ts
// @purpose: Lock in the withdrawal-flow consolidation — payApprovedWithdrawal
//           is the single place the creative token debit happens (at MARK_PAID),
//           it is race-safe (guarded flip), idempotent (a second call can't
//           double-debit), and it never drives the balance negative.
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { getUserTokenBalance } from "@/lib/token-engine";
import { payApprovedWithdrawal } from "@/lib/withdrawals";
import { resetDatabase } from "./helpers/db";
import { createUser, createWithdrawal, creditCreative } from "./helpers/fixtures";

async function markPaid(withdrawalId: string, actorEmail = "owner@test.local") {
  return prisma.$transaction((tx) => payApprovedWithdrawal(tx, withdrawalId, actorEmail));
}

describe("payApprovedWithdrawal (integration)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("debits the creative once and flips APPROVED → PAID", async () => {
    const creative = await createUser({ role: "DESIGNER" });
    await creditCreative(creative.id, 100);
    const w = await createWithdrawal({
      creativeId: creative.id,
      amountTokens: 40,
      status: "APPROVED",
    });

    const updated = await markPaid(w.id);
    expect(updated.status).toBe("PAID");

    expect(await getUserTokenBalance(creative.id)).toBe(60);

    const debit = await prisma.tokenLedger.findFirst({
      where: { userId: creative.id, direction: "DEBIT", reason: "WITHDRAWAL_PAID" },
    });
    expect(debit).not.toBeNull();
    expect(debit?.amount).toBe(40);
    expect((debit?.metadata as { withdrawalId?: string } | null)?.withdrawalId).toBe(w.id);
  });

  it("is idempotent — a second mark-paid can't double-debit", async () => {
    const creative = await createUser({ role: "DESIGNER" });
    await creditCreative(creative.id, 100);
    const w = await createWithdrawal({
      creativeId: creative.id,
      amountTokens: 40,
      status: "APPROVED",
    });

    await markPaid(w.id);
    await expect(markPaid(w.id)).rejects.toBeInstanceOf(Response);

    // Still exactly one debit, balance debited once.
    expect(await getUserTokenBalance(creative.id)).toBe(60);
    expect(
      await prisma.tokenLedger.count({
        where: { userId: creative.id, direction: "DEBIT", reason: "WITHDRAWAL_PAID" },
      }),
    ).toBe(1);
  });

  it("refuses a withdrawal that isn't APPROVED (no debit)", async () => {
    const creative = await createUser({ role: "DESIGNER" });
    await creditCreative(creative.id, 100);
    const w = await createWithdrawal({
      creativeId: creative.id,
      amountTokens: 40,
      status: "PENDING",
    });

    await expect(markPaid(w.id)).rejects.toBeInstanceOf(Response);

    const after = await prisma.withdrawal.findUniqueOrThrow({ where: { id: w.id } });
    expect(after.status).toBe("PENDING");
    expect(await getUserTokenBalance(creative.id)).toBe(100);
    expect(await prisma.tokenLedger.count({ where: { direction: "DEBIT" } })).toBe(0);
  });

  it("refuses to drive the balance negative and rolls back the flip", async () => {
    const creative = await createUser({ role: "DESIGNER" });
    await creditCreative(creative.id, 30); // less than the withdrawal amount
    const w = await createWithdrawal({
      creativeId: creative.id,
      amountTokens: 40,
      status: "APPROVED",
    });

    await expect(markPaid(w.id)).rejects.toMatchObject({ status: 400 });

    // Status flip was rolled back, no debit written, balance intact.
    const after = await prisma.withdrawal.findUniqueOrThrow({ where: { id: w.id } });
    expect(after.status).toBe("APPROVED");
    expect(await getUserTokenBalance(creative.id)).toBe(30);
    expect(await prisma.tokenLedger.count({ where: { direction: "DEBIT" } })).toBe(0);
  });
});
