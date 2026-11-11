// -----------------------------------------------------------------------------
// @file: lib/engagement/monthly-recap.ts
// @purpose: The numbers in a customer's monthly recap, and the honest version
//           of "what an agency would have charged": each delivered request's
//           typical hours (from the service, or the nearest deliverable in
//           our public cost calculator) times the calculator's typical US
//           agency rate. It is always shown as an estimate with how it was
//           worked out. Pure and client-safe.
// -----------------------------------------------------------------------------

import { roundMoney } from "@/lib/cost/calculate";
import { DELIVERABLES, RATES } from "@/lib/cost/rates";

export type RecapMonth = {
  /** "2026-10" */
  key: string;
  /** "October 2026" */
  label: string;
  /** "October" */
  name: string;
  start: Date;
  /** Exclusive. */
  end: Date;
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** The calendar month before `now`, in UTC. */
export function previousMonth(now: Date): RecapMonth {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const name = MONTH_NAMES[start.getUTCMonth()]!;
  return {
    key: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
    label: `${name} ${start.getUTCFullYear()}`,
    name,
    start,
    end,
  };
}

/** Words in a service name that point at a cost-calculator deliverable. */
const DELIVERABLE_HINTS: Record<string, string[]> = {
  "social-post": ["social", "instagram", "post", "carousel", "story", "stories"],
  "ad-set": ["ad", "ads", "banner", "advert"],
  email: ["email", "newsletter"],
  infographic: ["infographic"],
  illustration: ["illustration", "icon", "mascot"],
  flyer: ["flyer", "brochure", "leaflet", "poster", "print"],
  deck: ["deck", "presentation", "pitch", "slides"],
  "landing-page": ["landing"],
  website: ["website", "web design", "ui design"],
  logo: ["logo"],
  "brand-identity": ["identity", "branding", "brand strategy", "brand guidelines"],
  packaging: ["packaging", "label"],
};

/** Typical hours for a service from the cost calculator, or null if nothing fits. */
export function calculatorHours(serviceName: string | null | undefined): number | null {
  if (!serviceName) return null;
  const text = serviceName.toLowerCase();
  for (const deliverable of DELIVERABLES) {
    const hints = DELIVERABLE_HINTS[deliverable.id] ?? [];
    if (hints.some((hint) => new RegExp(`(^|[^a-z])${hint}([^a-z]|$)`).test(text))) {
      return deliverable.hours.typical;
    }
  }
  return null;
}

export const AGENCY_HOURLY_USD = RATES.us.agencyHourly.typical;

export type RecapJob = {
  serviceName: string | null;
  /** Hours on the service in our catalog, when set. */
  estimatedHours: number | null;
};

/**
 * Estimated agency price for the month's delivered requests, in USD, rounded
 * to a friendly figure. Null when none of the requests can be estimated.
 */
export function agencyEquivalentUsd(jobs: RecapJob[]): number | null {
  let hours = 0;
  let counted = 0;
  for (const job of jobs) {
    const h =
      job.estimatedHours && job.estimatedHours > 0
        ? job.estimatedHours
        : calculatorHours(job.serviceName);
    if (h) {
      hours += h;
      counted += 1;
    }
  }
  return counted === 0 ? null : roundMoney(hours * AGENCY_HOURLY_USD);
}

export type MonthlyRecap = {
  monthKey: string;
  monthLabel: string;
  monthName: string;
  jobsDelivered: number;
  tokensUsed: number;
  agencyEquivalentUsd: number | null;
};

export const HOW_ESTIMATED = `We take each delivered request's typical hours and multiply by a typical US agency rate ($${AGENCY_HOURLY_USD} an hour), the same figures as our cost calculator. It's an estimate, not a quote.`;

export function formatUsd(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}

/** The line the "Share recap" button copies. */
export function recapShareText(recap: MonthlyRecap, companyName?: string | null): string {
  const who = companyName ? `${companyName}'s` : "Our";
  const jobs = `${recap.jobsDelivered} ${recap.jobsDelivered === 1 ? "request" : "requests"} delivered`;
  const agency =
    recap.agencyEquivalentUsd !== null
      ? `, about ${formatUsd(recap.agencyEquivalentUsd)} of agency work (estimate)`
      : "";
  return `${who} ${recap.monthLabel} with brandbite: ${jobs}${agency}. https://brandbite.studio`;
}
