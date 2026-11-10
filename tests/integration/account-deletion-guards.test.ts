// -----------------------------------------------------------------------------
// @file: tests/integration/account-deletion-guards.test.ts
// @purpose: Self-deletion must not strand others: the only Owner of a company
//           with other members, or a creative with open jobs or unpaid
//           withdrawals, is blocked (409) until that's resolved. Everyone
//           else can still delete (right to erasure).
// -----------------------------------------------------------------------------

import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { deleteOwnAccount, findSelfDeletionBlocker } from "@/lib/account-deletion";
import { resetDatabase } from "./helpers/db";
import {
  addCompanyMember,
  createCompany,
  createTicket,
  createUser,
  createWithdrawal,
} from "./helpers/fixtures";

beforeEach(async () => {
  await resetDatabase();
});

describe("findSelfDeletionBlocker — customers", () => {
  it("blocks the only Owner when other members remain", async () => {
    const company = await createCompany();
    const owner = await createUser();
    const member = await createUser();
    await addCompanyMember(company.id, owner.id, "OWNER");
    await addCompanyMember(company.id, member.id, "MEMBER");

    const reason = await findSelfDeletionBlocker(owner.id, "CUSTOMER");
    expect(reason).toMatch(/only Owner/);
  });

  it("allows an Owner when another Owner exists", async () => {
    const company = await createCompany();
    const owner = await createUser();
    const coOwner = await createUser();
    await addCompanyMember(company.id, owner.id, "OWNER");
    await addCompanyMember(company.id, coOwner.id, "OWNER");

    expect(await findSelfDeletionBlocker(owner.id, "CUSTOMER")).toBeNull();
  });

  it("allows the sole member of a company", async () => {
    const company = await createCompany();
    const owner = await createUser();
    await addCompanyMember(company.id, owner.id, "OWNER");

    expect(await findSelfDeletionBlocker(owner.id, "CUSTOMER")).toBeNull();
  });

  it("ignores deleted accounts when looking for another Owner", async () => {
    const company = await createCompany();
    const owner = await createUser();
    const deletedOwner = await createUser();
    const member = await createUser();
    await addCompanyMember(company.id, owner.id, "OWNER");
    await addCompanyMember(company.id, deletedOwner.id, "OWNER");
    await addCompanyMember(company.id, member.id, "MEMBER");
    await prisma.userAccount.update({
      where: { id: deletedOwner.id },
      data: { deletedAt: new Date() },
    });

    expect(await findSelfDeletionBlocker(owner.id, "CUSTOMER")).toMatch(/only Owner/);
  });

  it("does not block non-owners", async () => {
    const company = await createCompany();
    const owner = await createUser();
    const member = await createUser();
    await addCompanyMember(company.id, owner.id, "OWNER");
    await addCompanyMember(company.id, member.id, "MEMBER");

    expect(await findSelfDeletionBlocker(member.id, "CUSTOMER")).toBeNull();
  });
});

describe("findSelfDeletionBlocker — creatives", () => {
  async function seedCreative() {
    const company = await createCompany();
    const customer = await createUser();
    const creative = await createUser({ role: "DESIGNER" });
    return { company, customer, creative };
  }

  it("blocks a creative with open assigned jobs", async () => {
    const { company, customer, creative } = await seedCreative();
    await createTicket({
      companyId: company.id,
      createdById: customer.id,
      creativeId: creative.id,
      status: "IN_PROGRESS",
    });

    expect(await findSelfDeletionBlocker(creative.id, "DESIGNER")).toMatch(/1 open request/);
  });

  it("does not count finished jobs", async () => {
    const { company, customer, creative } = await seedCreative();
    await createTicket({
      companyId: company.id,
      createdById: customer.id,
      creativeId: creative.id,
      status: "DONE",
    });

    expect(await findSelfDeletionBlocker(creative.id, "DESIGNER")).toBeNull();
  });

  it("blocks pending and approved withdrawals, not paid or rejected ones", async () => {
    const { creative } = await seedCreative();
    await createWithdrawal({ creativeId: creative.id, amountTokens: 50, status: "PAID" });
    await createWithdrawal({ creativeId: creative.id, amountTokens: 50, status: "REJECTED" });
    expect(await findSelfDeletionBlocker(creative.id, "DESIGNER")).toBeNull();

    await createWithdrawal({ creativeId: creative.id, amountTokens: 50, status: "APPROVED" });
    expect(await findSelfDeletionBlocker(creative.id, "DESIGNER")).toMatch(/withdrawal/);
  });
});

describe("deleteOwnAccount", () => {
  it("returns 409 and leaves the account intact when blocked", async () => {
    const company = await createCompany();
    const owner = await createUser({ email: "owner@test.brandbite.local" });
    const member = await createUser();
    await addCompanyMember(company.id, owner.id, "OWNER");
    await addCompanyMember(company.id, member.id, "MEMBER");

    const result = await deleteOwnAccount({
      userId: owner.id,
      sessionEmail: "owner@test.brandbite.local",
      expectedRole: "CUSTOMER",
      confirmEmail: "owner@test.brandbite.local",
    });

    expect(result).toMatchObject({ ok: false, status: 409 });
    const after = await prisma.userAccount.findUniqueOrThrow({ where: { id: owner.id } });
    expect(after.deletedAt).toBeNull();
  });
});
