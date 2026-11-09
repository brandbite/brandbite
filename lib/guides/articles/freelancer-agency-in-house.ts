// -----------------------------------------------------------------------------
// @file: lib/guides/articles/freelancer-agency-in-house.ts
// @purpose: Public guide: freelancer vs agency vs in-house designer. Numbers
//           come from lib/cost/rates.ts (same sources as the cost calculator),
//           so the guide and the calculator never disagree.
// -----------------------------------------------------------------------------

import {
  estimate,
  formatMoney,
  formatRange,
  PRODUCTIVE_HOURS_PER_MONTH,
} from "@/lib/cost/calculate";
import { DELIVERABLES, RATES, RECRUITING, STARTER_QUANTITIES } from "@/lib/cost/rates";
import type { SupportGuide } from "@/lib/support/types";

const us = RATES.us;
const eu = RATES.eu;
const overheadPct = Math.round((us.employerCostMultiplier - 1) * 100);

/** The calculator's starter month, priced at typical US rates. */
const example = estimate(DELIVERABLES, {
  quantities: STARTER_QUANTITIES,
  freelancerHourly: us.freelancerHourly.typical,
  agencyHourly: us.agencyHourly.typical,
  inHouseSalary: us.inHouseSalary,
  employerCostMultiplier: us.employerCostMultiplier,
});

export const FREELANCER_AGENCY_GUIDE: SupportGuide = {
  slug: "freelancer-vs-agency-vs-in-house-designer",
  title: "Freelancer vs agency vs in-house designer",
  summary:
    "What each option really costs in the US and Europe, what you get for it, and how to choose for your amount of design work.",
  category: "Working with designers",
  routes: [],
  keywords: [
    "hire a designer",
    "design agency cost",
    "freelance designer rates",
    "in-house designer salary",
    "outsource design",
  ],
  sections: [
    {
      heading: "The short answer",
      blocks: [
        {
          type: "list",
          items: [
            {
              term: "Freelancer",
              text: "Best for occasional, well-defined projects when you have time to manage them.",
            },
            {
              term: "Agency",
              text: "Best for big launches and rebrands that need strategy and a team.",
            },
            {
              term: "In-house",
              text: "Best when you have a steady, full-time amount of design work.",
            },
          ],
        },
        {
          type: "p",
          text: "Most growing teams fall between these: more work than an occasional freelancer, less than a full-time hire. That middle is where the real cost comparison matters.",
        },
      ],
    },
    {
      heading: "What each option costs",
      blocks: [
        {
          type: "p",
          text: `Typical rates in 2026, from public surveys and official statistics (sources are listed with the design cost calculator):`,
        },
        {
          type: "list",
          items: [
            {
              term: "Freelance designer",
              text: `${formatRange(us.freelancerHourly, "USD")} an hour in the US, ${formatRange(eu.freelancerHourly, "EUR")} in Western Europe, typically around ${formatMoney(us.freelancerHourly.typical, "USD")} and ${formatMoney(eu.freelancerHourly.typical, "EUR")}.`,
            },
            {
              term: "Design agency",
              text: `${formatRange(us.agencyHourly, "USD")} an hour in the US, ${formatRange(eu.agencyHourly, "EUR")} in Western Europe.`,
            },
            {
              term: "In-house designer",
              text: `A median salary of ${formatMoney(us.inHouseSalary, "USD")} a year in the US (Bureau of Labor Statistics) and about ${formatMoney(eu.inHouseSalary, "EUR")} in Germany, plus roughly ${overheadPct}% for benefits, taxes and equipment.`,
            },
          ],
        },
        {
          type: "tip",
          text: "Prices exclude VAT and sales tax. Senior people and specialist work, like motion or packaging, cost more.",
        },
      ],
    },
    {
      heading: "Freelancers",
      blocks: [
        {
          type: "p",
          text: "Freelancers are the cheapest per hour and the most flexible: you pay for the work you need and nothing else. A good freelancer who knows your brand can be excellent value.",
        },
        {
          type: "list",
          items: [
            "Finding someone good takes time, and their availability changes.",
            "You do the project management: briefs, feedback, deadlines and files.",
            "One person rarely covers every skill, so bigger needs mean several freelancers.",
            "If they move on, the knowledge of your brand goes with them.",
          ],
        },
      ],
    },
    {
      heading: "Agencies",
      blocks: [
        {
          type: "p",
          text: "Agencies bring a team: strategists, designers and account managers, with process and quality control. For a rebrand or a major campaign, that structure is worth paying for.",
        },
        {
          type: "list",
          items: [
            `Hourly rates are much higher: about ${Math.round(us.agencyHourly.typical / us.freelancerHourly.typical)} times a typical freelancer's in the US.`,
            "Many have project minimums or monthly retainers.",
            "Scoped projects are slower to start and to change.",
            "Small, frequent requests are expensive relative to the work.",
          ],
        },
      ],
    },
    {
      heading: "In-house designers",
      blocks: [
        {
          type: "p",
          text: "A designer on your team learns your brand deeply and is there when you need them. When there is enough work to fill their week, this is usually the best long-term value.",
        },
        {
          type: "list",
          items: [
            `You pay a full salary plus about ${overheadPct}% in employer costs, whether or not there is work that month.`,
            `Hiring takes time and money; SHRM puts the average cost per hire at ${formatMoney(RECRUITING.costPerHireUsd, "USD")}.`,
            `One designer has roughly ${PRODUCTIVE_HOURS_PER_MONTH} hours of real design time a month once meetings and admin are taken out.`,
            "One person has one set of skills; illustration, motion or web may still need outside help.",
          ],
        },
      ],
    },
    {
      heading: "How to choose",
      blocks: [
        {
          type: "steps",
          items: [
            "List the design work you need in a typical month: posts, ads, emails, decks, pages.",
            "Estimate the hours. A social post is a couple of hours; a landing page can be 15 to 80.",
            `If it's well under ${PRODUCTIVE_HOURS_PER_MONTH / 2} hours a month, a full-time hire will sit idle much of the time.`,
            "If it's spiky, with big launches and quiet months, pay-as-you-go options fit better than salaries.",
            "Count your own time too: managing freelancers is real work.",
          ],
        },
        {
          type: "p",
          text: "The design cost calculator does this sum for you, with the rates above as defaults you can change.",
        },
      ],
    },
    {
      heading: "A fourth option: design subscriptions",
      blocks: [
        {
          type: "p",
          text: "Design subscriptions charge a flat monthly fee for a stream of design requests handled by a team. They suit teams in the middle: steady work, but not enough for a full-time hire, and no time to manage freelancers. Look at turnaround times, what counts as one request, who owns the files and whether you can pause.",
        },
      ],
    },
    {
      heading: "A worked example: a typical startup month",
      blocks: [
        {
          type: "p",
          text: `Take a month with twelve social posts, two ad sets, two email designs and one presentation. Using typical hours for each, that's about ${Math.round(example.hours.typical)} hours of design work (${Math.round(example.hours.low)} to ${Math.round(example.hours.high)}, depending on complexity).`,
        },
        {
          type: "list",
          items: [
            {
              term: "Freelancer",
              text: `About ${formatRange(example.freelancer, "USD")} a month in the US at ${formatMoney(us.freelancerHourly.typical, "USD")} an hour, plus your time to manage it.`,
            },
            {
              term: "Agency",
              text: `About ${formatRange(example.agency, "USD")} a month at ${formatMoney(us.agencyHourly.typical, "USD")} an hour, if they take on work this small.`,
            },
            {
              term: "In-house",
              text: `About ${formatMoney(example.inHouse, "USD")} a month in salary and employer costs, for a designer who would be busy for roughly ${Math.round((example.hours.typical / PRODUCTIVE_HOURS_PER_MONTH) * 100)}% of their time.`,
            },
          ],
        },
        {
          type: "p",
          text: "The numbers change a lot with your mix of work, which is why it's worth running your own month through the calculator.",
        },
      ],
    },
    {
      heading: "Questions to ask before you choose",
      blocks: [
        {
          type: "list",
          items: [
            {
              term: "Freelancer",
              text: "Can I see work like mine? How fast do you usually reply? Who owns the source files? What happens if you're unavailable?",
            },
            {
              term: "Agency",
              text: "Who will actually do the work? Is there a minimum project size or retainer? How are extra revision rounds billed?",
            },
            {
              term: "In-house",
              text: "Is there a full-time amount of work for the next year? Who will manage and give feedback to this person? Which skills will we still need from outside?",
            },
          ],
        },
      ],
    },
    {
      heading: "Frequently asked questions",
      blocks: [
        {
          type: "list",
          items: [
            {
              term: "Is it cheaper to hire a freelancer or an agency?",
              text: "Per hour, a freelancer almost always costs less. An agency can still be better value for big projects, where strategy and coordination save time and mistakes.",
            },
            {
              term: "When should a startup hire its first designer?",
              text: "When there's steady design work for most of a full-time week, and someone who can give that designer direction and feedback.",
            },
            {
              term: "Can I mix options?",
              text: "Yes, and many teams do: an agency for the brand, freelancers or a subscription for everyday work, and an in-house designer once the volume justifies it.",
            },
            {
              term: "What does a design subscription cost?",
              text: "Subscriptions charge a flat monthly fee for ongoing requests. Compare what's included: turnaround, number of active requests, and who owns the files.",
            },
          ],
        },
      ],
    },
  ],
};
