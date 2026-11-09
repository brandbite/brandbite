import { describe, expect, it } from "vitest";

import {
  estimate,
  formatMoney,
  formatRange,
  PRODUCTIVE_HOURS_PER_MONTH,
  roundMoney,
  type Inputs,
} from "@/lib/cost/calculate";
import { DELIVERABLES, RATES, STARTER_QUANTITIES } from "@/lib/cost/rates";

const base: Inputs = {
  quantities: {},
  freelancerHourly: 50,
  agencyHourly: 150,
  inHouseSalary: 60000,
  employerCostMultiplier: 1.3,
};

describe("cost data", () => {
  it("has ordered hour ranges and unique ids", () => {
    const ids = DELIVERABLES.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of DELIVERABLES) {
      expect(d.hours.low, d.id).toBeGreaterThan(0);
      expect(d.hours.low, d.id).toBeLessThanOrEqual(d.hours.typical);
      expect(d.hours.typical, d.id).toBeLessThanOrEqual(d.hours.high);
    }
    for (const id of Object.keys(STARTER_QUANTITIES)) expect(ids).toContain(id);
  });

  it("has ordered rate ranges for both regions", () => {
    for (const rates of Object.values(RATES)) {
      for (const r of [rates.freelancerHourly, rates.agencyHourly]) {
        expect(r.low).toBeLessThanOrEqual(r.typical);
        expect(r.typical).toBeLessThanOrEqual(r.high);
      }
      expect(rates.employerCostMultiplier).toBeGreaterThan(1);
    }
  });
});

describe("estimate", () => {
  it("is zero with no work", () => {
    const result = estimate(DELIVERABLES, base);
    expect(result.hours).toEqual({ low: 0, typical: 0, high: 0 });
    expect(result.inHouse).toBe(0);
    expect(result.designersNeeded).toBe(0);
  });

  it("multiplies hours by quantity and rate", () => {
    const result = estimate(DELIVERABLES, { ...base, quantities: { "social-post": 10 } });
    expect(result.hours).toEqual({ low: 10, typical: 20, high: 60 });
    expect(result.freelancer.typical).toBe(1000);
    expect(result.agency.typical).toBe(3000);
    expect(result.designersNeeded).toBe(1);
    expect(result.inHouse).toBeCloseTo((60000 * 1.3) / 12);
  });

  it("adds designers when the work is more than one person's month", () => {
    const result = estimate(DELIVERABLES, { ...base, quantities: { website: 2 } });
    expect(result.hours.typical).toBe(160);
    expect(result.designersNeeded).toBe(Math.ceil(160 / PRODUCTIVE_HOURS_PER_MONTH));
  });

  it("ignores negative and fractional quantities", () => {
    const result = estimate(DELIVERABLES, { ...base, quantities: { logo: -3, email: 1.7 } });
    expect(result.hours.typical).toBe(6);
  });
});

describe("money formatting", () => {
  it("rounds to friendly figures", () => {
    expect(roundMoney(0)).toBe(0);
    expect(roundMoney(347)).toBe(350);
    expect(roundMoney(12345)).toBe(12300);
    expect(formatMoney(12345, "USD")).toBe("$12,300");
    expect(formatMoney(980, "EUR")).toBe("€980");
    expect(formatRange({ low: 100, typical: 150, high: 200 }, "USD")).toBe("$100 – $200");
    expect(formatRange({ low: 0, typical: 0, high: 0 }, "USD")).toBe("$0");
  });
});
