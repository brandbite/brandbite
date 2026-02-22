// -----------------------------------------------------------------------------
// @file: lib/__tests__/company-roles.test.ts
// @purpose: Unit tests for company-level permission helpers
// -----------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import {
  normalizeCompanyRole,
  isCompanyAdminRole,
  canManageMembers,
  canManagePlan,
  canCreateTickets,
  canMarkTicketsDoneForCompany,
  isBillingReadOnly,
} from "@/lib/permissions/companyRoles";

// ---------------------------------------------------------------------------
// normalizeCompanyRole
// ---------------------------------------------------------------------------

describe("normalizeCompanyRole", () => {
  it("returns valid roles unchanged", () => {
    expect(normalizeCompanyRole("OWNER")).toBe("OWNER");
    expect(normalizeCompanyRole("PM")).toBe("PM");
    expect(normalizeCompanyRole("BILLING")).toBe("BILLING");
    expect(normalizeCompanyRole("MEMBER")).toBe("MEMBER");
  });

  it("returns null for invalid values", () => {
    expect(normalizeCompanyRole("ADMIN")).toBeNull();
    expect(normalizeCompanyRole("")).toBeNull();
    expect(normalizeCompanyRole(null)).toBeNull();
    expect(normalizeCompanyRole(undefined)).toBeNull();
    expect(normalizeCompanyRole(42)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isCompanyAdminRole
// ---------------------------------------------------------------------------

describe("isCompanyAdminRole", () => {
  it("returns true for OWNER and PM", () => {
    expect(isCompanyAdminRole("OWNER")).toBe(true);
    expect(isCompanyAdminRole("PM")).toBe(true);
  });

  it("returns false for BILLING and MEMBER", () => {
    expect(isCompanyAdminRole("BILLING")).toBe(false);
    expect(isCompanyAdminRole("MEMBER")).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isCompanyAdminRole(null)).toBe(false);
    expect(isCompanyAdminRole(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// canManageMembers
// ---------------------------------------------------------------------------

describe("canManageMembers", () => {
  it("allows OWNER and PM", () => {
    expect(canManageMembers("OWNER")).toBe(true);
    expect(canManageMembers("PM")).toBe(true);
  });

  it("denies BILLING and MEMBER", () => {
    expect(canManageMembers("BILLING")).toBe(false);
    expect(canManageMembers("MEMBER")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// canManagePlan
// ---------------------------------------------------------------------------

describe("canManagePlan", () => {
  it("allows OWNER and BILLING", () => {
    expect(canManagePlan("OWNER")).toBe(true);
    expect(canManagePlan("BILLING")).toBe(true);
  });

  it("denies PM and MEMBER", () => {
    expect(canManagePlan("PM")).toBe(false);
    expect(canManagePlan("MEMBER")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// canCreateTickets
// ---------------------------------------------------------------------------

describe("canCreateTickets", () => {
  it("allows OWNER, PM, and MEMBER", () => {
    expect(canCreateTickets("OWNER")).toBe(true);
    expect(canCreateTickets("PM")).toBe(true);
    expect(canCreateTickets("MEMBER")).toBe(true);
  });

  it("denies BILLING (read-only for tickets)", () => {
    expect(canCreateTickets("BILLING")).toBe(false);
  });

  it("denies null/undefined", () => {
    expect(canCreateTickets(null)).toBe(false);
    expect(canCreateTickets(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// canMarkTicketsDoneForCompany
// ---------------------------------------------------------------------------

describe("canMarkTicketsDoneForCompany", () => {
  it("allows SITE_OWNER regardless of company role", () => {
    expect(canMarkTicketsDoneForCompany("SITE_OWNER", null)).toBe(true);
    expect(canMarkTicketsDoneForCompany("SITE_OWNER", "MEMBER")).toBe(true);
  });

  it("allows SITE_ADMIN regardless of company role", () => {
    expect(canMarkTicketsDoneForCompany("SITE_ADMIN", null)).toBe(true);
  });

  it("allows CUSTOMER with OWNER or PM company role", () => {
    expect(canMarkTicketsDoneForCompany("CUSTOMER", "OWNER")).toBe(true);
    expect(canMarkTicketsDoneForCompany("CUSTOMER", "PM")).toBe(true);
  });

  it("denies CUSTOMER with BILLING or MEMBER company role", () => {
    expect(canMarkTicketsDoneForCompany("CUSTOMER", "BILLING")).toBe(false);
    expect(canMarkTicketsDoneForCompany("CUSTOMER", "MEMBER")).toBe(false);
  });

  it("denies DESIGNER even with company role", () => {
    expect(canMarkTicketsDoneForCompany("DESIGNER", "OWNER")).toBe(false);
  });

  it("denies null global role", () => {
    expect(canMarkTicketsDoneForCompany(null, "OWNER")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isBillingReadOnly
// ---------------------------------------------------------------------------

describe("isBillingReadOnly", () => {
  it("returns true only for BILLING", () => {
    expect(isBillingReadOnly("BILLING")).toBe(true);
    expect(isBillingReadOnly("OWNER")).toBe(false);
    expect(isBillingReadOnly("PM")).toBe(false);
    expect(isBillingReadOnly("MEMBER")).toBe(false);
    expect(isBillingReadOnly(null)).toBe(false);
  });
});
