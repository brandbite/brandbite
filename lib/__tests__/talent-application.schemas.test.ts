// -----------------------------------------------------------------------------
// @file: lib/__tests__/talent-application.schemas.test.ts
// @purpose: Regression suite for the public talent-application Zod schema.
//           These tests pin down the conditional rules (yearsRemote /
//           preferredTasksPerWeek / toolsOther) so a future refactor that
//           accidentally drops a `.refine` fails loudly instead of letting
//           half-filled applications land in the DB.
// -----------------------------------------------------------------------------

import { describe, it, expect } from "vitest";

import { talentApplicationSubmitSchema } from "../schemas/talent-application.schemas";

/** Minimum-valid payload — every refine-relevant flag set to its "no
 *  conditional sibling needed" value. Tests deviate one field at a time
 *  from this baseline so a failure points at the exact rule under test. */
function baseValid() {
  return {
    fullName: "Jane Designer",
    whatsappNumber: "+90 555 555 5555",
    email: "jane@example.com",
    country: "Türkiye",
    timezone: "Europe/Istanbul",
    portfolioUrl: "https://jane.design",
    linkedinUrl: null,
    socialLinks: [],
    // Three valid cuid-shaped IDs. Schema only requires non-empty strings
    // — the cross-validation against JobTypeCategory.isActive happens at
    // the API layer.
    categoryIds: [
      "clxxx0000000000000000000a",
      "clxxx0000000000000000000b",
      "clxxx0000000000000000000c",
    ],
    totalYears: "5-10" as const,
    hasRemoteExp: false,
    yearsRemote: null,
    workedWith: ["STARTUPS"] as const,
    workload: "PART_TIME" as const,
    preferredTasksPerWeek: null,
    turnaroundOk: true,
    turnaroundComment: "",
    tools: ["FIGMA"] as const,
    toolsOther: null,
    testTaskOk: true,
    communicationConfirmed: true as const,
    turnstileToken: "tok_test_xxx",
  };
}

describe("talentApplicationSubmitSchema — happy path", () => {
  it("accepts a complete minimum-valid submission", () => {
    const r = talentApplicationSubmitSchema.safeParse(baseValid());
    expect(r.success).toBe(true);
  });

  it("normalizes email to lowercase and trims whitespace", () => {
    const r = talentApplicationSubmitSchema.safeParse({
      ...baseValid(),
      email: "  Jane@Example.COM  ",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("jane@example.com");
  });
});

describe("talentApplicationSubmitSchema — required-field rejections", () => {
  it("rejects when fewer than 3 categories are selected", () => {
    const r = talentApplicationSubmitSchema.safeParse({
      ...baseValid(),
      categoryIds: ["a", "b"],
    });
    expect(r.success).toBe(false);
  });

  it("rejects an unconfirmed communication checkbox", () => {
    const r = talentApplicationSubmitSchema.safeParse({
      ...baseValid(),
      communicationConfirmed: false,
    });
    expect(r.success).toBe(false);
  });

  it("rejects an empty workedWith array", () => {
    const r = talentApplicationSubmitSchema.safeParse({
      ...baseValid(),
      workedWith: [],
    });
    expect(r.success).toBe(false);
  });

  it("rejects an empty tools array", () => {
    const r = talentApplicationSubmitSchema.safeParse({
      ...baseValid(),
      tools: [],
    });
    expect(r.success).toBe(false);
  });

  it("rejects a missing Turnstile token", () => {
    const r = talentApplicationSubmitSchema.safeParse({
      ...baseValid(),
      turnstileToken: "",
    });
    expect(r.success).toBe(false);
  });
});

describe("talentApplicationSubmitSchema — conditional refinements", () => {
  it("rejects hasRemoteExp=true without yearsRemote", () => {
    const r = talentApplicationSubmitSchema.safeParse({
      ...baseValid(),
      hasRemoteExp: true,
      yearsRemote: null,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes("yearsRemote"))).toBe(true);
    }
  });

  it("accepts hasRemoteExp=true with yearsRemote provided", () => {
    const r = talentApplicationSubmitSchema.safeParse({
      ...baseValid(),
      hasRemoteExp: true,
      yearsRemote: "2-5" as const,
    });
    expect(r.success).toBe(true);
  });

  it("rejects workload=FULL_TIME without preferredTasksPerWeek", () => {
    const r = talentApplicationSubmitSchema.safeParse({
      ...baseValid(),
      workload: "FULL_TIME" as const,
      preferredTasksPerWeek: null,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes("preferredTasksPerWeek"))).toBe(true);
    }
  });

  it("accepts workload=FULL_TIME with preferredTasksPerWeek provided", () => {
    const r = talentApplicationSubmitSchema.safeParse({
      ...baseValid(),
      workload: "FULL_TIME" as const,
      preferredTasksPerWeek: "3-5" as const,
    });
    expect(r.success).toBe(true);
  });

  it("rejects tools containing OTHER without toolsOther", () => {
    const r = talentApplicationSubmitSchema.safeParse({
      ...baseValid(),
      tools: ["FIGMA", "OTHER"] as const,
      toolsOther: null,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes("toolsOther"))).toBe(true);
    }
  });

  it("accepts tools containing OTHER with toolsOther provided", () => {
    const r = talentApplicationSubmitSchema.safeParse({
      ...baseValid(),
      tools: ["FIGMA", "OTHER"] as const,
      toolsOther: "Sketch, Affinity",
    });
    expect(r.success).toBe(true);
  });
});

describe("talentApplicationSubmitSchema — limits", () => {
  it("rejects more than 3 social links", () => {
    const r = talentApplicationSubmitSchema.safeParse({
      ...baseValid(),
      socialLinks: [
        "https://a.example",
        "https://b.example",
        "https://c.example",
        "https://d.example",
      ],
    });
    expect(r.success).toBe(false);
  });

  it("rejects a turnaroundComment longer than 120 characters", () => {
    const r = talentApplicationSubmitSchema.safeParse({
      ...baseValid(),
      turnaroundComment: "x".repeat(121),
    });
    expect(r.success).toBe(false);
  });

  it("rejects a non-URL portfolio value", () => {
    const r = talentApplicationSubmitSchema.safeParse({
      ...baseValid(),
      portfolioUrl: "not-a-url",
    });
    expect(r.success).toBe(false);
  });
});
