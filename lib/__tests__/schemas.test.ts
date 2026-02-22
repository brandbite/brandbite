// -----------------------------------------------------------------------------
// @file: lib/__tests__/schemas.test.ts
// @purpose: Unit tests for Zod validation schemas
// -----------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { createInviteSchema } from "@/lib/schemas/member.schemas";

// ---------------------------------------------------------------------------
// createInviteSchema
// ---------------------------------------------------------------------------

describe("createInviteSchema", () => {
  it("accepts valid email with default role", () => {
    const result = createInviteSchema.safeParse({ email: "test@example.com" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("test@example.com");
      expect(result.data.roleInCompany).toBe("MEMBER");
    }
  });

  it("trims and lowercases email", () => {
    const result = createInviteSchema.safeParse({ email: "  Test@Example.COM  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("test@example.com");
    }
  });

  it("accepts valid roleInCompany values", () => {
    for (const role of ["MEMBER", "PM", "BILLING"]) {
      const result = createInviteSchema.safeParse({
        email: "a@b.com",
        roleInCompany: role,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects OWNER role (not in allowed list)", () => {
    const result = createInviteSchema.safeParse({
      email: "a@b.com",
      roleInCompany: "OWNER",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty email", () => {
    const result = createInviteSchema.safeParse({ email: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = createInviteSchema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects missing email", () => {
    const result = createInviteSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
