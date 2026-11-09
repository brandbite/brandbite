// -----------------------------------------------------------------------------
// @file: lib/cost/rates.ts
// @purpose: Default market figures for the design cost calculator, researched
//           on `CHECKED_ON`. Rates and salaries come from surveys and official
//           statistics (sources below); hours per deliverable are estimates
//           built from published designer guides and contest price points,
//           and say so on the page. Recheck yearly.
//
//           Western Europe uses Germany's official median salary and the
//           middle of German, Dutch and French freelance rates.
// -----------------------------------------------------------------------------

import type { Deliverable, Region, RegionRates } from "./calculate";

export const CHECKED_ON = "2026-11-09";

export const DELIVERABLES: (Deliverable & { estimate: boolean })[] = [
  {
    id: "social-post",
    name: "Social media posts",
    hours: { low: 1, typical: 2, high: 6 },
    estimate: false,
  },
  {
    id: "ad-set",
    name: "Ad sets (one idea, several sizes)",
    hours: { low: 4, typical: 8, high: 15 },
    estimate: true,
  },
  { id: "email", name: "Email designs", hours: { low: 3, typical: 6, high: 12 }, estimate: false },
  {
    id: "infographic",
    name: "Infographics",
    hours: { low: 4, typical: 10, high: 20 },
    estimate: false,
  },
  {
    id: "illustration",
    name: "Illustrations",
    hours: { low: 2, typical: 4, high: 6 },
    estimate: false,
  },
  {
    id: "flyer",
    name: "Flyers or brochures",
    hours: { low: 3, typical: 6, high: 12 },
    estimate: false,
  },
  {
    id: "deck",
    name: "Presentations (about 15 slides)",
    hours: { low: 6, typical: 10, high: 20 },
    estimate: false,
  },
  {
    id: "landing-page",
    name: "Landing pages",
    hours: { low: 15, typical: 35, high: 80 },
    estimate: false,
  },
  {
    id: "website",
    name: "Website designs (about 5 pages)",
    hours: { low: 40, typical: 80, high: 150 },
    estimate: true,
  },
  { id: "logo", name: "Logos", hours: { low: 10, typical: 20, high: 30 }, estimate: false },
  {
    id: "brand-identity",
    name: "Brand identities",
    hours: { low: 20, typical: 45, high: 80 },
    estimate: false,
  },
  {
    id: "packaging",
    name: "Packaging designs",
    hours: { low: 15, typical: 30, high: 60 },
    estimate: false,
  },
];

/** A typical startup month, so the results aren't empty on arrival. */
export const STARTER_QUANTITIES: Record<string, number> = {
  "social-post": 12,
  "ad-set": 2,
  email: 2,
  deck: 1,
};

export const RATES: Record<Region, RegionRates> = {
  us: {
    currency: "USD",
    freelancerHourly: { low: 25, typical: 50, high: 100 },
    agencyHourly: { low: 100, typical: 150, high: 200 },
    inHouseSalary: 62960,
    // BLS: benefits are about 30% of total pay; leaving out paid leave, which
    // is already in the salary, gives about 1.3x base salary.
    employerCostMultiplier: 1.3,
  },
  eu: {
    currency: "EUR",
    freelancerHourly: { low: 50, typical: 75, high: 100 },
    agencyHourly: { low: 75, typical: 110, high: 150 },
    // Germany's official median for graphic designers, €4,149 a month.
    inHouseSalary: 49800,
    employerCostMultiplier: 1.3,
  },
};

export const RECRUITING = {
  costPerHireUsd: 5475,
  source: "SHRM 2025 benchmarking, average for non-executive roles",
};

export type CostSource = { label: string; url: string };

export const COST_SOURCES: CostSource[] = [
  {
    label: "U.S. Bureau of Labor Statistics: graphic designers, median pay (May 2025)",
    url: "https://www.bls.gov/ooh/arts-and-design/graphic-designers.htm",
  },
  {
    label: "U.S. Bureau of Labor Statistics: employer costs for employee compensation",
    url: "https://www.bls.gov/news.release/ecec.t04.htm",
  },
  {
    label: "Payscale: freelance graphic designer hourly rate",
    url: "https://www.payscale.com/research/US/Job=Freelance_Graphic_Designer/Hourly_Rate",
  },
  {
    label: "Thumbtack: graphic design prices",
    url: "https://www.thumbtack.com/p/graphic-design-prices",
  },
  { label: "Clutch: design agency pricing", url: "https://clutch.co/agencies/design/pricing" },
  {
    label: "freelancermap: freelance designer rates in Germany (2026)",
    url: "https://www.freelancermap.de/blog/stundensatz-grafiker-freelancer/",
  },
  {
    label: "Knab: freelance designer rates in the Netherlands (2026)",
    url: "https://bieb.knab.nl/ondernemen/wat-verdient-een-designer-zzp-bekijk-uurtarief-en-winst",
  },
  {
    label: "Bundesagentur für Arbeit Entgeltatlas: graphic designer pay in Germany",
    url: "https://web.arbeitsagentur.de/entgeltatlas/beruf/15505",
  },
  { label: "99designs: design pricing by category", url: "https://99designs.com/pricing" },
  {
    label: "SHRM: 2025 benchmarking reports (cost per hire)",
    url: "https://www.shrm.org/about/press-room/shrm-releases-2025-benchmarking-reports--how-does-your-organizat",
  },
];

/** Typical one-off prices for the guide table (99designs contest price points, USD). */
export const PRICE_EXAMPLES: { name: string; low: number; high: number }[] = [
  { name: "Logo", low: 249, high: 1050 },
  { name: "Brand identity pack", low: 599, high: 2499 },
  { name: "Packaging", low: 449, high: 1699 },
  { name: "Email design", low: 299, high: 1199 },
  { name: "Illustration", low: 349, high: 1399 },
];
