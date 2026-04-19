// -----------------------------------------------------------------------------
// @file: tests/integration/token-ledger.test.ts
// @purpose: applyCompanyLedgerEntry must keep Company.tokenBalance in sync
//           with TokenLedger rows and produce coherent before/after snapshots,
//           against a real Postgres (not a mocked client).
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { applyCompanyLedgerEntry, recalculateCompanyTokenBalance } from "@/lib/token-engine";
import { resetDatabase } from "./helpers/db";
import { createCompany } from "./helpers/fixtures";

describe("applyCompanyLedgerEntry (integration)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("debits tokens, writes ledger, and matches Company.tokenBalance", async () => {
    const company = await createCompany({ tokenBalance: 100 });

    const { balanceAfter } = await applyCompanyLedgerEntry({
      companyId: company.id,
      amount: 25,
      direction: "DEBIT",
      reason: "JOB_PAYMENT",
    });

    expect(balanceAfter).toBe(75);

    const refreshed = await prisma.company.findUniqueOrThrow({ where: { id: company.id } });
    expect(refreshed.tokenBalance).toBe(75);

    const entries = await prisma.tokenLedger.findMany({ where: { companyId: company.id } });
    expect(entries).toHaveLength(1);
    expect(entries[0].direction).toBe("DEBIT");
    expect(entries[0].amount).toBe(25);
    expect(entries[0].balanceBefore).toBe(100);
    expect(entries[0].balanceAfter).toBe(75);
  });

  it("credits and debits compose — ledger stays consistent across multiple ops", async () => {
    const company = await createCompany({ tokenBalance: 0 });

    await applyCompanyLedgerEntry({
      companyId: company.id,
      amount: 100,
      direction: "CREDIT",
      reason: "PLAN_PURCHASE",
    });
    await applyCompanyLedgerEntry({
      companyId: company.id,
      amount: 30,
      direction: "DEBIT",
      reason: "JOB_PAYMENT",
    });
    await applyCompanyLedgerEntry({
      companyId: company.id,
      amount: 10,
      direction: "CREDIT",
      reason: "REFUND",
    });

    const refreshed = await prisma.company.findUniqueOrThrow({ where: { id: company.id } });
    expect(refreshed.tokenBalance).toBe(80);

    const entries = await prisma.tokenLedger.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "asc" },
    });
    expect(entries.map((e) => e.balanceAfter)).toEqual([100, 70, 80]);
  });

  it("recalculateCompanyTokenBalance rebuilds cache from ledger", async () => {
    // Seed a company with a zero starting balance and build its ledger from
    // scratch. recalculateCompanyTokenBalance sums ledger rows alone, so the
    // fixture's cached tokenBalance field must not bypass the ledger.
    const company = await createCompany({ tokenBalance: 0 });

    await applyCompanyLedgerEntry({
      companyId: company.id,
      amount: 100,
      direction: "CREDIT",
      reason: "PLAN_PURCHASE",
    });
    await applyCompanyLedgerEntry({
      companyId: company.id,
      amount: 40,
      direction: "DEBIT",
      reason: "JOB_PAYMENT",
    });

    // Simulate a drifted cache
    await prisma.company.update({
      where: { id: company.id },
      data: { tokenBalance: 999 },
    });

    const realBalance = await recalculateCompanyTokenBalance(company.id);
    expect(realBalance).toBe(60);

    const refreshed = await prisma.company.findUniqueOrThrow({ where: { id: company.id } });
    expect(refreshed.tokenBalance).toBe(60);
  });
});
