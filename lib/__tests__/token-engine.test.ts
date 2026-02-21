// -----------------------------------------------------------------------------
// @file: lib/__tests__/token-engine.test.ts
// @purpose: Unit tests for pure token-engine helpers
// -----------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import {
  getEffectiveTokenValues,
  BASE_PAYOUT_PERCENT,
} from "@/lib/token-engine";

// ---------------------------------------------------------------------------
// getEffectiveTokenValues
// ---------------------------------------------------------------------------

describe("getEffectiveTokenValues", () => {
  const baseJobType = { tokenCost: 10, creativePayoutTokens: 6 };

  it("returns zeroes when jobType is null", () => {
    const result = getEffectiveTokenValues({
      quantity: 1,
      tokenCostOverride: null,
      creativePayoutOverride: null,
      jobType: null,
    });

    expect(result).toEqual({
      effectiveCost: 0,
      effectivePayout: 0,
      isOverridden: false,
    });
  });

  it("calculates base cost and payout from jobType * quantity", () => {
    const result = getEffectiveTokenValues({
      quantity: 3,
      tokenCostOverride: null,
      creativePayoutOverride: null,
      jobType: baseJobType,
    });

    expect(result.effectiveCost).toBe(30); // 10 * 3
    expect(result.effectivePayout).toBe(18); // 6 * 3
    expect(result.isOverridden).toBe(false);
  });

  it("uses tokenCostOverride when provided", () => {
    const result = getEffectiveTokenValues({
      quantity: 2,
      tokenCostOverride: 15,
      creativePayoutOverride: null,
      jobType: baseJobType,
    });

    expect(result.effectiveCost).toBe(15);
    expect(result.effectivePayout).toBe(12); // 6 * 2 (no payout override)
    expect(result.isOverridden).toBe(true);
  });

  it("uses creativePayoutOverride when provided", () => {
    const result = getEffectiveTokenValues({
      quantity: 2,
      tokenCostOverride: null,
      creativePayoutOverride: 25,
      jobType: baseJobType,
    });

    expect(result.effectiveCost).toBe(20); // 10 * 2
    expect(result.effectivePayout).toBe(25);
    expect(result.isOverridden).toBe(true);
  });

  it("uses both overrides when both are provided", () => {
    const result = getEffectiveTokenValues({
      quantity: 5,
      tokenCostOverride: 50,
      creativePayoutOverride: 40,
      jobType: baseJobType,
    });

    expect(result.effectiveCost).toBe(50);
    expect(result.effectivePayout).toBe(40);
    expect(result.isOverridden).toBe(true);
  });

  it("handles quantity of 1 (default case)", () => {
    const result = getEffectiveTokenValues({
      quantity: 1,
      tokenCostOverride: null,
      creativePayoutOverride: null,
      jobType: baseJobType,
    });

    expect(result.effectiveCost).toBe(10);
    expect(result.effectivePayout).toBe(6);
    expect(result.isOverridden).toBe(false);
  });

  it("handles override of 0 (free ticket)", () => {
    const result = getEffectiveTokenValues({
      quantity: 1,
      tokenCostOverride: 0,
      creativePayoutOverride: 0,
      jobType: baseJobType,
    });

    expect(result.effectiveCost).toBe(0);
    expect(result.effectivePayout).toBe(0);
    expect(result.isOverridden).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// BASE_PAYOUT_PERCENT constant
// ---------------------------------------------------------------------------

describe("BASE_PAYOUT_PERCENT", () => {
  it("is 60%", () => {
    expect(BASE_PAYOUT_PERCENT).toBe(60);
  });
});
