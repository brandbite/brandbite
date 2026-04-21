// -----------------------------------------------------------------------------
// @file: lib/__tests__/roles.test.ts
// @purpose: Unit tests for role utility functions
// -----------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import type { UserRole } from "@prisma/client";
import {
  canApproveWithdrawals,
  canAssignCompanyPlan,
  canEditAiToolPricing,
  canEditConsultationSettings,
  canEditPayoutRules,
  canGrantCompanyTokens,
  canHardDeleteUsers,
  canManagePlans,
  canMarkWithdrawalsPaid,
  canOverrideTicketFinancials,
  canPromoteToSiteAdmin,
  canToggleAiToolEnabled,
  isSiteAdminRole,
  isSiteOwnerRole,
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

// ---------------------------------------------------------------------------
// isSiteOwnerRole — strict owner check
// ---------------------------------------------------------------------------

describe("isSiteOwnerRole", () => {
  it("returns true only for SITE_OWNER", () => {
    expect(isSiteOwnerRole("SITE_OWNER")).toBe(true);
    expect(isSiteOwnerRole("SITE_ADMIN")).toBe(false);
    expect(isSiteOwnerRole("DESIGNER")).toBe(false);
    expect(isSiteOwnerRole("CUSTOMER")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Owner-only capability helpers
//
// Every helper below gates an action that can move money, change
// compensation, or escalate privileges. They MUST all behave identically
// to isSiteOwnerRole. If one drifts (e.g. someone accidentally widens it
// to SITE_ADMIN), these tests fail loudly.
// ---------------------------------------------------------------------------

const OWNER_ONLY_HELPERS: ReadonlyArray<[string, (role: UserRole) => boolean]> = [
  ["canPromoteToSiteAdmin", canPromoteToSiteAdmin],
  ["canApproveWithdrawals", canApproveWithdrawals],
  ["canMarkWithdrawalsPaid", canMarkWithdrawalsPaid],
  ["canManagePlans", canManagePlans],
  ["canAssignCompanyPlan", canAssignCompanyPlan],
  ["canEditPayoutRules", canEditPayoutRules],
  ["canGrantCompanyTokens", canGrantCompanyTokens],
  ["canOverrideTicketFinancials", canOverrideTicketFinancials],
  ["canEditConsultationSettings", canEditConsultationSettings],
  ["canEditAiToolPricing", canEditAiToolPricing],
  ["canHardDeleteUsers", canHardDeleteUsers],
];

describe("owner-only capability helpers", () => {
  for (const [name, fn] of OWNER_ONLY_HELPERS) {
    describe(name, () => {
      it("grants SITE_OWNER", () => {
        expect(fn("SITE_OWNER")).toBe(true);
      });

      for (const role of ["SITE_ADMIN", "DESIGNER", "CUSTOMER"] as UserRole[]) {
        it(`denies ${role}`, () => {
          expect(fn(role)).toBe(false);
        });
      }
    });
  }
});

// ---------------------------------------------------------------------------
// canToggleAiToolEnabled — admin-allowed (distinct from pricing edit)
// ---------------------------------------------------------------------------

describe("canToggleAiToolEnabled", () => {
  it("grants SITE_OWNER and SITE_ADMIN", () => {
    expect(canToggleAiToolEnabled("SITE_OWNER")).toBe(true);
    expect(canToggleAiToolEnabled("SITE_ADMIN")).toBe(true);
  });

  it("denies DESIGNER and CUSTOMER", () => {
    expect(canToggleAiToolEnabled("DESIGNER")).toBe(false);
    expect(canToggleAiToolEnabled("CUSTOMER")).toBe(false);
  });
});
