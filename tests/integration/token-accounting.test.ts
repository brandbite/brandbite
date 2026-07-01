// -----------------------------------------------------------------------------
// @file: tests/integration/token-accounting.test.ts
// @purpose: Regression coverage for the token-accounting fixes shipped in the
//           security/correctness audit (PR #268), against a real Postgres:
//             - completeTicketAndApplyTokens pays payout × quantity + honors
//               creativePayoutOverride (parity with the customer-board payout)
//             - createCustomerTicket debits atomically and refuses when the
//               balance can't cover the cost (no ticket, no debit)
//             - recalculateCompanyTokenBalance ignores creative-scoped ledger
//               rows that merely carry a companyId
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  BASE_PAYOUT_PERCENT,
  completeTicketAndApplyTokens,
  getUserTokenBalance,
  recalculateCompanyTokenBalance,
} from "@/lib/token-engine";
import { createCustomerTicket } from "@/lib/tickets/create-ticket";
import { resetDatabase } from "./helpers/db";
import {
  addCompanyMember,
  createCompany,
  createJobType,
  createTicket,
  createUser,
} from "./helpers/fixtures";

describe("token accounting (integration)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe("completeTicketAndApplyTokens", () => {
    it("credits the creative using the gamification model (tokenCost × quantity × payoutPercent)", async () => {
      // For an assigned creative with no override and no payout rules, the
      // completion engine pays tokenCost × quantity × BASE_PAYOUT_PERCENT — it
      // does NOT use jobType.creativePayoutTokens (that field only applies in
      // the no-creative fallback branch). Compute the expectation from the
      // real constant so this doesn't go stale if the base rate changes.
      const company = await createCompany({ tokenBalance: 1000 });
      const customer = await createUser({ role: "CUSTOMER" });
      const creative = await createUser({ role: "DESIGNER" });
      const jobType = await createJobType({ tokenCost: 30, creativePayoutTokens: 10 });

      const ticket = await createTicket({
        companyId: company.id,
        createdById: customer.id,
        creativeId: creative.id,
        jobTypeId: jobType.id,
        quantity: 5,
        status: "IN_REVIEW",
      });

      const result = await completeTicketAndApplyTokens(ticket.id);
      const expected = Math.round(30 * 5 * (BASE_PAYOUT_PERCENT / 100));

      expect(result.alreadyCompleted).toBe(false);
      expect(result.creativeBalanceAfter).toBe(expected);
      expect(await getUserTokenBalance(creative.id)).toBe(expected);
    });

    it("honors creativePayoutOverride over the computed amount", async () => {
      const company = await createCompany({ tokenBalance: 1000 });
      const customer = await createUser({ role: "CUSTOMER" });
      const creative = await createUser({ role: "DESIGNER" });
      const jobType = await createJobType({ tokenCost: 30, creativePayoutTokens: 10 });

      const ticket = await createTicket({
        companyId: company.id,
        createdById: customer.id,
        creativeId: creative.id,
        jobTypeId: jobType.id,
        quantity: 5,
        status: "IN_REVIEW",
        creativePayoutOverride: 77,
      });

      const result = await completeTicketAndApplyTokens(ticket.id);
      expect(result.creativeBalanceAfter).toBe(77);
      expect(await getUserTokenBalance(creative.id)).toBe(77);
    });

    it("is idempotent — a second call does not double-pay", async () => {
      const company = await createCompany({ tokenBalance: 1000 });
      const customer = await createUser({ role: "CUSTOMER" });
      const creative = await createUser({ role: "DESIGNER" });
      const jobType = await createJobType({ tokenCost: 30, creativePayoutTokens: 10 });

      const ticket = await createTicket({
        companyId: company.id,
        createdById: customer.id,
        creativeId: creative.id,
        jobTypeId: jobType.id,
        quantity: 2,
        status: "IN_REVIEW",
      });

      await completeTicketAndApplyTokens(ticket.id);
      const second = await completeTicketAndApplyTokens(ticket.id);

      const expected = Math.round(30 * 2 * (BASE_PAYOUT_PERCENT / 100));
      expect(second.alreadyCompleted).toBe(true);
      // Balance reflects a single payout, not two.
      expect(await getUserTokenBalance(creative.id)).toBe(expected);
    });
  });

  describe("createCustomerTicket", () => {
    it("debits the company atomically and writes a JOB_REQUEST_CREATED ledger row", async () => {
      const company = await createCompany({ tokenBalance: 100 });
      const owner = await createUser({ role: "CUSTOMER" });
      await addCompanyMember(company.id, owner.id, "OWNER");
      const jobType = await createJobType({ tokenCost: 30, creativePayoutTokens: 10 });

      const res = await createCustomerTicket({
        actorUserId: owner.id,
        companyId: company.id,
        data: {
          title: "Need a banner",
          description: null,
          projectId: null,
          jobTypeId: jobType.id,
          quantity: 2,
          priority: "MEDIUM",
          dueDate: null,
          tagIds: [],
          creativeMode: "DESIGNER",
          moodboardId: null,
        },
      });

      expect(res.success).toBe(true);

      const refreshed = await prisma.company.findUniqueOrThrow({ where: { id: company.id } });
      expect(refreshed.tokenBalance).toBe(40); // 100 - 30×2

      const ledger = await prisma.tokenLedger.findMany({ where: { companyId: company.id } });
      expect(ledger).toHaveLength(1);
      expect(ledger[0].direction).toBe("DEBIT");
      expect(ledger[0].amount).toBe(60);
      expect(ledger[0].reason).toBe("JOB_REQUEST_CREATED");
    });

    it("refuses when the balance can't cover the cost — no ticket, no debit", async () => {
      const company = await createCompany({ tokenBalance: 10 });
      const owner = await createUser({ role: "CUSTOMER" });
      await addCompanyMember(company.id, owner.id, "OWNER");
      const jobType = await createJobType({ tokenCost: 30, creativePayoutTokens: 10 });

      const res = await createCustomerTicket({
        actorUserId: owner.id,
        companyId: company.id,
        data: {
          title: "Too expensive",
          description: null,
          projectId: null,
          jobTypeId: jobType.id,
          quantity: 1,
          priority: "MEDIUM",
          dueDate: null,
          tagIds: [],
          creativeMode: "DESIGNER",
          moodboardId: null,
        },
      });

      expect(res.success).toBe(false);
      if (!res.success) expect(res.code).toBe("INSUFFICIENT_TOKENS");

      const refreshed = await prisma.company.findUniqueOrThrow({ where: { id: company.id } });
      expect(refreshed.tokenBalance).toBe(10); // untouched

      expect(await prisma.ticket.count({ where: { companyId: company.id } })).toBe(0);
      expect(await prisma.tokenLedger.count({ where: { companyId: company.id } })).toBe(0);
    });
  });

  describe("recalculateCompanyTokenBalance", () => {
    it("ignores creative-scoped ledger rows that carry a companyId", async () => {
      const company = await createCompany({ tokenBalance: 0 });
      const creative = await createUser({ role: "DESIGNER" });

      // Company-scoped rows (userId null): +100 then -100 → net 0.
      await prisma.tokenLedger.create({
        data: {
          companyId: company.id,
          direction: "CREDIT",
          amount: 100,
          reason: "PLAN_PURCHASE",
          balanceBefore: 0,
          balanceAfter: 100,
        },
      });
      await prisma.tokenLedger.create({
        data: {
          companyId: company.id,
          direction: "DEBIT",
          amount: 100,
          reason: "JOB_REQUEST_CREATED",
          balanceBefore: 100,
          balanceAfter: 0,
        },
      });

      // A creative payout CREDIT that also carries this companyId but belongs
      // to the creative's balance (userId set). It must NOT count toward the
      // company balance.
      await prisma.tokenLedger.create({
        data: {
          companyId: company.id,
          userId: creative.id,
          direction: "CREDIT",
          amount: 60,
          reason: "JOB_PAYMENT",
          balanceBefore: 0,
          balanceAfter: 60,
        },
      });

      const real = await recalculateCompanyTokenBalance(company.id);
      expect(real).toBe(0); // pre-fix this was 60 (inflated by the payout row)
    });
  });
});
