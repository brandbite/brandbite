// -----------------------------------------------------------------------------
// @file: tests/integration/helpers/fixtures.ts
// @purpose: Minimal fixtures for integration tests — a plan, a company with
//           tokens, a customer, and a creative. Each fixture is opt-in so
//           tests only create what they need.
// -----------------------------------------------------------------------------

import { prisma } from "@/lib/prisma";

let seq = 0;
const nextSuffix = () => `${Date.now()}-${++seq}`;

export async function createPlan(overrides?: { monthlyTokens?: number }) {
  return prisma.plan.create({
    data: {
      name: `Test Plan ${nextSuffix()}`,
      monthlyTokens: overrides?.monthlyTokens ?? 400,
      priceCents: 0,
      isActive: true,
    },
  });
}

export async function createCompany(overrides?: { tokenBalance?: number; planId?: string }) {
  const suffix = nextSuffix();
  return prisma.company.create({
    data: {
      name: `Test Company ${suffix}`,
      slug: `test-co-${suffix}`,
      tokenBalance: overrides?.tokenBalance ?? 100,
      planId: overrides?.planId ?? null,
    },
  });
}

type UserOverrides = {
  role?: "CUSTOMER" | "DESIGNER" | "SITE_ADMIN" | "SITE_OWNER";
  email?: string;
};

export async function createUser(overrides?: UserOverrides) {
  const suffix = nextSuffix();
  return prisma.userAccount.create({
    data: {
      authUserId: `auth-${suffix}`,
      email: overrides?.email ?? `user-${suffix}@test.brandbite.local`,
      name: "Test User",
      role: overrides?.role ?? "CUSTOMER",
    },
  });
}

export async function addCompanyMember(
  companyId: string,
  userId: string,
  role: "OWNER" | "PM" | "BILLING" | "MEMBER" = "MEMBER",
) {
  return prisma.companyMember.create({
    data: { companyId, userId, roleInCompany: role },
  });
}

export async function createWithdrawal(args: {
  creativeId: string;
  amountTokens: number;
  status?: "PENDING" | "APPROVED" | "PAID" | "REJECTED";
}) {
  return prisma.withdrawal.create({
    data: {
      creativeId: args.creativeId,
      amountTokens: args.amountTokens,
      status: args.status ?? "PENDING",
      approvedAt: args.status === "APPROVED" || args.status === "PAID" ? new Date() : null,
    },
  });
}

/** Give a creative a starting token balance by writing a CREDIT ledger row. */
export async function creditCreative(creativeId: string, amount: number) {
  return prisma.tokenLedger.create({
    data: {
      userId: creativeId,
      direction: "CREDIT",
      amount,
      reason: "JOB_PAYMENT",
      balanceBefore: 0,
      balanceAfter: amount,
    },
  });
}

export async function createJobType(overrides?: {
  tokenCost?: number;
  creativePayoutTokens?: number;
}) {
  return prisma.jobType.create({
    data: {
      name: `Test Job ${nextSuffix()}`,
      tokenCost: overrides?.tokenCost ?? 30,
      creativePayoutTokens: overrides?.creativePayoutTokens ?? 10,
      isActive: true,
    },
  });
}

export async function createTicket(args: {
  companyId: string;
  createdById: string;
  jobTypeId?: string | null;
  creativeId?: string | null;
  quantity?: number;
  status?: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
  creativePayoutOverride?: number | null;
  tokenCostOverride?: number | null;
}) {
  return prisma.ticket.create({
    data: {
      title: `Test Ticket ${nextSuffix()}`,
      companyId: args.companyId,
      createdById: args.createdById,
      jobTypeId: args.jobTypeId ?? null,
      creativeId: args.creativeId ?? null,
      quantity: args.quantity ?? 1,
      status: args.status ?? "TODO",
      creativePayoutOverride: args.creativePayoutOverride ?? null,
      tokenCostOverride: args.tokenCostOverride ?? null,
    },
  });
}
