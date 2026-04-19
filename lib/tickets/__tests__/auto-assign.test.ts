// -----------------------------------------------------------------------------
// @file: lib/tickets/__tests__/auto-assign.test.ts
// @purpose: Unit tests for isAutoAssignEnabled — project override precedence
//           and INHERIT fall-through to company default.
// -----------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import { AutoAssignMode } from "@prisma/client";

import { isAutoAssignEnabled } from "../auto-assign";

describe("isAutoAssignEnabled", () => {
  describe("no project mode / INHERIT", () => {
    it("returns the company default when project mode is null", () => {
      expect(isAutoAssignEnabled(true, null)).toBe(true);
      expect(isAutoAssignEnabled(false, null)).toBe(false);
    });

    it("returns the company default when project mode is undefined", () => {
      expect(isAutoAssignEnabled(true)).toBe(true);
      expect(isAutoAssignEnabled(false)).toBe(false);
    });

    it("returns the company default when project mode is INHERIT", () => {
      expect(isAutoAssignEnabled(true, AutoAssignMode.INHERIT)).toBe(true);
      expect(isAutoAssignEnabled(false, AutoAssignMode.INHERIT)).toBe(false);
    });
  });

  describe("project override", () => {
    it("ON forces true regardless of company default", () => {
      expect(isAutoAssignEnabled(false, AutoAssignMode.ON)).toBe(true);
      expect(isAutoAssignEnabled(true, AutoAssignMode.ON)).toBe(true);
    });

    it("OFF forces false regardless of company default", () => {
      expect(isAutoAssignEnabled(true, AutoAssignMode.OFF)).toBe(false);
      expect(isAutoAssignEnabled(false, AutoAssignMode.OFF)).toBe(false);
    });
  });
});
