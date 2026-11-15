import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { companyMember: { findMany } } }));

import { questionnaireRecipients } from "@/lib/brand/questionnaire.server";

const FORM = {
  id: "q1",
  brandName: "Northwind",
  companyName: "Northwind",
  companyId: "c1",
  createdById: "pm-1",
};

beforeEach(() => findMany.mockReset());

describe("questionnaireRecipients", () => {
  it("tells the person who made the link while they can still edit the guide", async () => {
    findMany.mockResolvedValueOnce([
      { userId: "owner-1", roleInCompany: "OWNER" },
      { userId: "pm-1", roleInCompany: "PM" },
    ]);
    expect(await questionnaireRecipients(FORM)).toEqual(["pm-1"]);
    expect(findMany.mock.calls[0]![0].where).toEqual({
      companyId: "c1",
      roleInCompany: { in: ["OWNER", "PM"] },
    });
  });

  it("falls back to the owners when that person left or lost the role", async () => {
    findMany.mockResolvedValue([
      { userId: "owner-1", roleInCompany: "OWNER" },
      { userId: "owner-2", roleInCompany: "OWNER" },
      { userId: "pm-2", roleInCompany: "PM" },
    ]);
    expect(await questionnaireRecipients(FORM)).toEqual(["owner-1", "owner-2"]);
    expect(await questionnaireRecipients({ ...FORM, createdById: null })).toEqual([
      "owner-1",
      "owner-2",
    ]);
  });
});
