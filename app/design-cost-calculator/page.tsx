// -----------------------------------------------------------------------------
// @file: app/design-cost-calculator/page.tsx
// @purpose: Free design cost calculator, with a server-rendered guide to what
//           design costs and where the numbers come from.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";

import { StudioShell } from "@/components/colors/studio/studio-shell";
import { CostCalculator } from "@/components/cost/cost-calculator";
import { JsonLd } from "@/components/seo/json-ld";
import { stackedTable as st } from "@/components/ui/stacked-table";
import { formatMoney, formatRange, PRODUCTIVE_HOURS_PER_MONTH } from "@/lib/cost/calculate";
import {
  CHECKED_ON,
  COST_SOURCES,
  DELIVERABLES,
  PRICE_EXAMPLES,
  RATES,
  RECRUITING,
} from "@/lib/cost/rates";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbJsonLd, webApplicationJsonLd } from "@/lib/seo/structured-data";

const TOOL = {
  name: "Design Cost Calculator",
  path: "/design-cost-calculator",
  description:
    "Estimate what your monthly design work costs with a freelancer, an agency or an in-house designer, using 2026 market rates for the US and Western Europe.",
};

export const metadata: Metadata = pageMetadata({
  title: "Graphic Design Cost Calculator 2026",
  description: TOOL.description,
  path: TOOL.path,
  image: "/design-cost-calculator/opengraph-image",
});

const CHECKED = new Date(`${CHECKED_ON}T00:00:00Z`).toLocaleDateString("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export default function DesignCostCalculatorPage() {
  const us = RATES.us;
  const eu = RATES.eu;
  const estimates = DELIVERABLES.filter((d) => d.estimate).map((d) => d.name.toLowerCase());

  return (
    <StudioShell
      label="COST CALCULATOR"
      nav={null}
      title="What does design"
      accent="really cost?"
      blurb="Pick what you need each month. Compare a freelancer, an agency and an in-house designer."
      ctaHeading="Know the cost."
      ctaHeadingAccent="Skip the overhead."
      ctaBlurb="brandbite is one flat subscription for your design work. Pause anytime."
    >
      <JsonLd
        data={[
          webApplicationJsonLd({ ...TOOL, category: "BusinessApplication" }),
          breadcrumbJsonLd([{ name: TOOL.name, path: TOOL.path }]),
        ]}
      />

      <CostCalculator />

      <section
        aria-labelledby="guide-heading"
        className="mt-6 rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-8 max-[767px]:p-5"
      >
        <h2 id="guide-heading" className="text-2xl leading-8 font-semibold">
          How much does graphic design cost in 2026?
        </h2>
        <p className="mt-3 max-w-[760px] text-base leading-7">
          It depends less on the design than on who does it. The same social post costs very
          different amounts from a freelancer, an agency or a designer on your payroll, because you
          pay for hours, for a team, or for a whole year of someone&apos;s time.
        </p>

        <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--cs-border)]">
          <table
            className={`w-full min-w-[560px] border-collapse text-left text-sm leading-5 ${st.table}`}
          >
            <caption
              className={`px-5 pt-5 pb-3 text-left text-lg leading-7 font-semibold ${st.caption}`}
            >
              Typical rates ({CHECKED})
            </caption>
            <thead className={st.head}>
              <tr className="border-y border-[var(--cs-border)] text-[var(--cs-muted)]">
                <th scope="col" className="px-5 py-3 font-medium">
                  Option
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  United States
                </th>
                <th scope="col" className="px-5 py-3 font-medium">
                  Western Europe
                </th>
              </tr>
            </thead>
            <tbody className={st.body}>
              <tr className={`border-b border-[var(--cs-border)] ${st.row}`}>
                <th scope="row" className={`px-5 py-3 font-medium ${st.rowHeader}`}>
                  Freelance designer, per hour
                </th>
                <td data-label="United States" className={`px-5 py-3 ${st.cell}`}>
                  {formatRange(us.freelancerHourly, "USD")}
                </td>
                <td data-label="Western Europe" className={`px-5 py-3 ${st.cell}`}>
                  {formatRange(eu.freelancerHourly, "EUR")}
                </td>
              </tr>
              <tr className={`border-b border-[var(--cs-border)] ${st.row}`}>
                <th scope="row" className={`px-5 py-3 font-medium ${st.rowHeader}`}>
                  Design agency, per hour
                </th>
                <td data-label="United States" className={`px-5 py-3 ${st.cell}`}>
                  {formatRange(us.agencyHourly, "USD")}
                </td>
                <td data-label="Western Europe" className={`px-5 py-3 ${st.cell}`}>
                  {formatRange(eu.agencyHourly, "EUR")}
                </td>
              </tr>
              <tr className={st.row}>
                <th scope="row" className={`px-5 py-3 font-medium ${st.rowHeader}`}>
                  In-house designer, median salary per year
                </th>
                <td data-label="United States" className={`px-5 py-3 ${st.cell}`}>
                  {formatMoney(us.inHouseSalary, "USD")}
                </td>
                <td data-label="Western Europe" className={`px-5 py-3 ${st.cell}`}>
                  {formatMoney(eu.inHouseSalary, "EUR")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="mt-8 text-2xl leading-8 font-semibold">Freelancer, agency or in-house?</h2>
        <div className="mt-4 grid grid-cols-3 gap-6 max-[1023px]:grid-cols-1">
          <div>
            <h3 className="text-base leading-6 font-semibold">Freelancer</h3>
            <p className="mt-1 text-base leading-6 text-[var(--cs-muted)]">
              The cheapest per hour and the most flexible. The cost you don&apos;t see is your own
              time: finding someone good, briefing them, and starting again when they are busy.
            </p>
          </div>
          <div>
            <h3 className="text-base leading-6 font-semibold">Agency</h3>
            <p className="mt-1 text-base leading-6 text-[var(--cs-muted)]">
              A team with strategy and project management, at a much higher hourly rate than a
              freelancer. Best for big launches; heavy for a steady stream of everyday work.
            </p>
          </div>
          <div>
            <h3 className="text-base leading-6 font-semibold">In-house designer</h3>
            <p className="mt-1 text-base leading-6 text-[var(--cs-muted)]">
              Always available and deep in your brand. Expect the employer cost to be about{" "}
              {Math.round((us.employerCostMultiplier - 1) * 100)}% above salary, plus hiring: SHRM
              puts the average cost per hire at {formatMoney(RECRUITING.costPerHireUsd, "USD")}. One
              designer has about {PRODUCTIVE_HOURS_PER_MONTH} hours of design time a month.
            </p>
          </div>
        </div>

        <h2 className="mt-8 text-2xl leading-8 font-semibold">What single projects cost</h2>
        <p className="mt-3 max-w-[760px] text-base leading-7">
          Design contest sites publish fixed prices, which mark the lower end of the market for
          one-off work:
        </p>
        <ul className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-base leading-6 max-[767px]:grid-cols-1">
          {PRICE_EXAMPLES.map((item) => (
            <li
              key={item.name}
              className="flex justify-between gap-4 border-b border-[var(--cs-border)] py-2"
            >
              <span>{item.name}</span>
              <span className="font-semibold">
                {formatMoney(item.low, "USD")} – {formatMoney(item.high, "USD")}
              </span>
            </li>
          ))}
        </ul>

        <h2 className="mt-8 text-2xl leading-8 font-semibold">How we calculate</h2>
        <p className="mt-3 max-w-[760px] text-base leading-7">
          Each item has a low, typical and high number of design hours, including one round of
          revisions. We multiply the hours by the hourly rate for freelancers and agencies. For
          in-house, we take the yearly salary plus employer costs, divide by twelve, and add another
          designer for every {PRODUCTIVE_HOURS_PER_MONTH} hours of work. Hours come from published
          designer and agency guides;{" "}
          {estimates.length > 0
            ? `the hours for ${estimates.join(" and ")} are our own estimate. `
            : ""}
          Prices exclude VAT and sales tax.
        </p>

        <h2 className="mt-8 text-lg leading-7 font-semibold">Sources</h2>
        <p className="mt-1 text-sm leading-5 text-[var(--cs-muted)]">Checked in {CHECKED}.</p>
        <ul className="mt-2 flex flex-col gap-1 text-sm leading-5">
          {COST_SOURCES.map((source) => (
            <li key={source.url}>
              <a
                href={source.url}
                className="text-[var(--cs-brand-strong)] hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {source.label}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </StudioShell>
  );
}
