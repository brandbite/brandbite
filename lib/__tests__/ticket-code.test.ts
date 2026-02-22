// -----------------------------------------------------------------------------
// @file: lib/__tests__/ticket-code.test.ts
// @purpose: Unit tests for buildTicketCode utility
// -----------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { buildTicketCode } from "../ticket-code";

describe("buildTicketCode", () => {
  it("builds WEB-101 when project code and ticket number exist", () => {
    expect(
      buildTicketCode({
        projectCode: "WEB",
        companyTicketNumber: 101,
        ticketId: "abc123",
      }),
    ).toBe("WEB-101");
  });

  it("builds #101 when no project code", () => {
    expect(
      buildTicketCode({
        projectCode: null,
        companyTicketNumber: 101,
        ticketId: "abc123",
      }),
    ).toBe("#101");
  });

  it("builds #101 when project code is undefined", () => {
    expect(
      buildTicketCode({
        companyTicketNumber: 101,
        ticketId: "abc123",
      }),
    ).toBe("#101");
  });

  it("falls back to ticketId when no ticket number", () => {
    expect(
      buildTicketCode({
        projectCode: "WEB",
        companyTicketNumber: null,
        ticketId: "abc123",
      }),
    ).toBe("abc123");
  });

  it("falls back to ticketId when nothing is provided", () => {
    expect(
      buildTicketCode({
        ticketId: "xyz789",
      }),
    ).toBe("xyz789");
  });

  it("handles ticket number 0", () => {
    expect(
      buildTicketCode({
        projectCode: "WEB",
        companyTicketNumber: 0,
        ticketId: "abc123",
      }),
    ).toBe("WEB-0");
  });

  it("handles empty project code", () => {
    expect(
      buildTicketCode({
        projectCode: "",
        companyTicketNumber: 101,
        ticketId: "abc123",
      }),
    ).toBe("#101");
  });
});
