// -----------------------------------------------------------------------------
// @file: lib/__tests__/schemas.test.ts
// @purpose: Unit tests for Zod validation schemas
// -----------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { createInviteSchema } from "@/lib/schemas/member.schemas";
import { createTicketSchema } from "@/lib/schemas/ticket.schemas";

// ---------------------------------------------------------------------------
// createTicketSchema — job type is required on every ticket (model 2)
// ---------------------------------------------------------------------------

describe("createTicketSchema jobTypeId", () => {
  const base = { title: "Need a banner", creativeMode: "DESIGNER" as const };

  it("rejects a ticket with no job type", () => {
    const result = createTicketSchema.safeParse({ ...base, jobTypeId: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Please select a job type.");
    }
  });

  it("rejects a missing jobTypeId field entirely", () => {
    const result = createTicketSchema.safeParse(base);
    expect(result.success).toBe(false);
  });

  it("rejects an AI-mode ticket with no job type (required in both modes)", () => {
    const result = createTicketSchema.safeParse({ ...base, creativeMode: "AI", jobTypeId: "" });
    expect(result.success).toBe(false);
  });

  it("accepts a ticket with a job type", () => {
    const result = createTicketSchema.safeParse({ ...base, jobTypeId: "job_123" });
    expect(result.success).toBe(true);
  });
});

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
