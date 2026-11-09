// -----------------------------------------------------------------------------
// @file: lib/cost/calculate.ts
// @purpose: The design cost calculator's maths: hours for a monthly workload,
//           and what that costs with a freelancer, an agency or an in-house
//           designer. Pure, so the numbers are tested.
// -----------------------------------------------------------------------------

export type Region = "us" | "eu";

export type Range = { low: number; typical: number; high: number };

export type Deliverable = {
  id: string;
  name: string;
  /** Hours of design work for one, including a round of revisions. */
  hours: Range;
};

export type RegionRates = {
  currency: "USD" | "EUR";
  freelancerHourly: Range;
  agencyHourly: Range;
  /** Median annual base salary of an in-house graphic designer. */
  inHouseSalary: number;
  /** Salary × this = cost to the employer (benefits, taxes, equipment). */
  employerCostMultiplier: number;
};

export type Inputs = {
  quantities: Record<string, number>;
  freelancerHourly: number;
  agencyHourly: number;
  inHouseSalary: number;
  employerCostMultiplier: number;
};

/** Productive design hours one full-time designer has in a month. */
export const PRODUCTIVE_HOURS_PER_MONTH = 120;

export type Estimate = {
  hours: Range;
  freelancer: Range;
  agency: Range;
  /** Monthly cost of enough in-house designers to cover typical hours. */
  inHouse: number;
  designersNeeded: number;
};

function scale(range: Range, factor: number): Range {
  return { low: range.low * factor, typical: range.typical * factor, high: range.high * factor };
}

function add(a: Range, b: Range): Range {
  return { low: a.low + b.low, typical: a.typical + b.typical, high: a.high + b.high };
}

/** Rounds money to a friendly figure: tens below 1,000, hundreds above. */
export function roundMoney(value: number): number {
  if (value <= 0) return 0;
  const step = value < 1000 ? 10 : 100;
  return Math.round(value / step) * step;
}

export function estimate(deliverables: Deliverable[], inputs: Inputs): Estimate {
  let hours: Range = { low: 0, typical: 0, high: 0 };
  for (const deliverable of deliverables) {
    const quantity = Math.max(0, Math.floor(inputs.quantities[deliverable.id] ?? 0));
    if (quantity) hours = add(hours, scale(deliverable.hours, quantity));
  }
  const monthlyEmployerCost = (inputs.inHouseSalary * inputs.employerCostMultiplier) / 12;
  const designersNeeded =
    hours.typical === 0 ? 0 : Math.max(1, Math.ceil(hours.typical / PRODUCTIVE_HOURS_PER_MONTH));

  return {
    hours,
    freelancer: scale(hours, inputs.freelancerHourly),
    agency: scale(hours, inputs.agencyHourly),
    inHouse: monthlyEmployerCost * designersNeeded,
    designersNeeded,
  };
}

export function formatMoney(value: number, currency: "USD" | "EUR"): string {
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "en-IE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(roundMoney(value));
}

export function formatRange(range: Range, currency: "USD" | "EUR"): string {
  const low = formatMoney(range.low, currency);
  const high = formatMoney(range.high, currency);
  return low === high ? low : `${low} – ${high}`;
}
