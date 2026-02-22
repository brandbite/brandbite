// -----------------------------------------------------------------------------
// @file: lib/__tests__/roles.test.ts
// @purpose: Unit tests for role utility functions
// -----------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import {
  isSiteAdminRole,
  isCreativeRole,
  isCustomerRole,
  hasActiveCompany,
  isAtLeastCompanyPM,
  formatRole,
  type SessionUser,
} from "@/lib/roles";

// ---------------------------------------------------------------------------
// isSiteAdminRole
// ---------------------------------------------------------------------------

describe("isSiteAdminRole", () => {
  it("returns true for SITE_OWNER", () => {
    expect(isSiteAdminRole("SITE_OWNER")).toBe(true);
  });

  it("returns true for SITE_ADMIN", () => {
    expect(isSiteAdminRole("SITE_ADMIN")).toBe(true);
  });

  it("returns false for DESIGNER", () => {
    expect(isSiteAdminRole("DESIGNER")).toBe(false);
  });

  it("returns false for CUSTOMER", () => {
    expect(isSiteAdminRole("CUSTOMER")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isCreativeRole / isCustomerRole
// ---------------------------------------------------------------------------

describe("isCreativeRole", () => {
  it("returns true for DESIGNER", () => {
    expect(isCreativeRole("DESIGNER")).toBe(true);
  });

  it("returns false for CUSTOMER", () => {
    expect(isCreativeRole("CUSTOMER")).toBe(false);
  });
});

describe("isCustomerRole", () => {
  it("returns true for CUSTOMER", () => {
    expect(isCustomerRole("CUSTOMER")).toBe(true);
  });

  it("returns false for DESIGNER", () => {
    expect(isCustomerRole("DESIGNER")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasActiveCompany
// ---------------------------------------------------------------------------

describe("hasActiveCompany", () => {
  it("returns true when activeCompanyId is set", () => {
    const user: SessionUser = {
      id: "u1",
      email: "test@test.com",
      role: "CUSTOMER",
      activeCompanyId: "comp1",
    };
    expect(hasActiveCompany(user)).toBe(true);
  });

  it("returns false when activeCompanyId is null", () => {
    const user: SessionUser = {
      id: "u1",
      email: "test@test.com",
      role: "CUSTOMER",
      activeCompanyId: null,
    };
    expect(hasActiveCompany(user)).toBe(false);
  });

  it("returns false when activeCompanyId is undefined", () => {
    const user: SessionUser = {
      id: "u1",
      email: "test@test.com",
      role: "CUSTOMER",
    };
    expect(hasActiveCompany(user)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isAtLeastCompanyPM
// ---------------------------------------------------------------------------

describe("isAtLeastCompanyPM", () => {
  it("returns true for OWNER", () => {
    expect(isAtLeastCompanyPM("OWNER")).toBe(true);
  });

  it("returns true for PM", () => {
    expect(isAtLeastCompanyPM("PM")).toBe(true);
  });

  it("returns false for BILLING", () => {
    expect(isAtLeastCompanyPM("BILLING")).toBe(false);
  });

  it("returns false for MEMBER", () => {
    expect(isAtLeastCompanyPM("MEMBER")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isAtLeastCompanyPM(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isAtLeastCompanyPM(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formatRole
// ---------------------------------------------------------------------------

describe("formatRole", () => {
  it("formats SITE_OWNER", () => {
    expect(formatRole("SITE_OWNER")).toBe("Site owner");
  });

  it("formats SITE_ADMIN", () => {
    expect(formatRole("SITE_ADMIN")).toBe("Site admin");
  });

  it("formats DESIGNER as Creative", () => {
    expect(formatRole("DESIGNER")).toBe("Creative");
  });

  it("formats CUSTOMER", () => {
    expect(formatRole("CUSTOMER")).toBe("Customer");
  });
});
