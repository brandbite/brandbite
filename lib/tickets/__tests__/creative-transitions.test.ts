// -----------------------------------------------------------------------------
// @file: lib/tickets/__tests__/creative-transitions.test.ts
// @purpose: The creative status rule shared by the PATCH and bulk routes.
// -----------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import { allowedCreativeTargets, creativeTransitionError } from "../creative-transitions";

describe("creativeTransitionError", () => {
  it.each([
    ["TODO", "IN_PROGRESS"],
    ["IN_PROGRESS", "IN_REVIEW"],
    ["IN_PROGRESS", "TODO"],
    ["IN_REVIEW", "IN_PROGRESS"],
  ] as const)("allows %s → %s", (from, to) => {
    expect(creativeTransitionError(from, to)).toBeNull();
  });

  it("treats same-status as a no-op", () => {
    expect(creativeTransitionError("IN_REVIEW", "IN_REVIEW")).toBeNull();
  });

  it("refuses skipping straight to review", () => {
    expect(creativeTransitionError("TODO", "IN_REVIEW")).toMatch(/Start the ticket first/);
  });

  it("refuses sending delivered work back to To do", () => {
    expect(creativeTransitionError("IN_REVIEW", "TODO")).toMatch(/Pull it back/);
  });

  it("refuses anything into or out of DONE", () => {
    expect(creativeTransitionError("IN_REVIEW", "DONE")).not.toBeNull();
    expect(creativeTransitionError("DONE", "IN_PROGRESS")).not.toBeNull();
  });
});

describe("allowedCreativeTargets", () => {
  it("lists the moves for each status", () => {
    expect(allowedCreativeTargets("TODO")).toEqual(["IN_PROGRESS"]);
    expect(allowedCreativeTargets("DONE")).toEqual([]);
  });
});
