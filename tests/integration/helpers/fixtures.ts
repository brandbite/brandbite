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
