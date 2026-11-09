// -----------------------------------------------------------------------------
// @file: components/cost/cost-calculator.tsx
// @purpose: Design cost calculator: pick a monthly workload and a region, see
//           what it costs with a freelancer, an agency or an in-house
//           designer. Defaults are researched market rates; every rate can be
//           changed. Runs entirely in the browser.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { ArrowRightIcon } from "@/components/colors/studio/icons";
import { studioButtonClasses } from "@/components/colors/studio/studio-button";
import {
  estimate,
  formatMoney,
  formatRange,
  PRODUCTIVE_HOURS_PER_MONTH,
  type Inputs,
  type Region,
} from "@/lib/cost/calculate";
import { DELIVERABLES, RATES, STARTER_QUANTITIES } from "@/lib/cost/rates";

const INPUT =
  "h-11 w-full rounded-[10px] border border-[var(--cs-border)] bg-[var(--cs-surface)] px-3 text-base focus:border-[var(--cs-text)]";

function defaultInputs(region: Region, quantities: Record<string, number>): Inputs {
  const rates = RATES[region];
  return {
    quantities,
    freelancerHourly: rates.freelancerHourly.typical,
    agencyHourly: rates.agencyHourly.typical,
    inHouseSalary: rates.inHouseSalary,
    employerCostMultiplier: rates.employerCostMultiplier,
  };
}

function Stepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--cs-border)] py-2.5 last:border-b-0">
      <label htmlFor={id} className="text-sm leading-5 font-medium">
        {label}
      </label>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          aria-label={`Fewer: ${label}`}
          className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-[var(--cs-border)] text-lg hover:border-[var(--cs-text)] disabled:opacity-40"
          disabled={value === 0}
          onClick={() => onChange(Math.max(0, value - 1))}
        >
          −
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          max={99}
          value={value}
          onChange={(event) => {
            const next = Number.parseInt(event.target.value, 10);
            onChange(Number.isFinite(next) ? Math.min(99, Math.max(0, next)) : 0);
          }}
          className="h-11 w-14 rounded-[10px] border border-[var(--cs-border)] bg-[var(--cs-surface)] text-center text-base"
        />
        <button
          type="button"
          aria-label={`More: ${label}`}
          className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-[var(--cs-border)] text-lg hover:border-[var(--cs-text)] disabled:opacity-40"
          disabled={value >= 99}
          onClick={() => onChange(Math.min(99, value + 1))}
        >
          +
        </button>
      </div>
    </div>
  );
}

function MoneyField({
  label,
  value,
  onChange,
  prefix,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  prefix: string;
  hint: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm leading-5 font-semibold">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--cs-muted)]">
          {prefix}
        </span>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          value={value}
          onChange={(event) => {
            const next = Number.parseFloat(event.target.value);
            onChange(Number.isFinite(next) && next >= 0 ? next : 0);
          }}
          className={`${INPUT} pl-8`}
        />
      </div>
      <p className="text-sm leading-5 text-[var(--cs-muted)]">{hint}</p>
    </div>
  );
}

export function CostCalculator() {
  const [region, setRegion] = useState<Region>("us");
  const [inputs, setInputs] = useState<Inputs>(() => defaultInputs("us", STARTER_QUANTITIES));

  const rates = RATES[region];
  const symbol = rates.currency === "USD" ? "$" : "€";
  const result = useMemo(() => estimate(DELIVERABLES, inputs), [inputs]);
  const hasWork = result.hours.typical > 0;

  function changeRegion(next: Region) {
    setRegion(next);
    setInputs((current) => defaultInputs(next, current.quantities));
  }

  function setQuantity(id: string, value: number) {
    setInputs((current) => ({ ...current, quantities: { ...current.quantities, [id]: value } }));
  }

  const options = [
    {
      key: "freelancer",
      title: "Freelancer",
      monthly: formatRange(result.freelancer, rates.currency),
      typical: result.freelancer.typical,
      notes: [
        "Pay only for the hours you use.",
        "Finding, briefing and managing them is on you.",
        "Availability varies; big jobs may need several people.",
      ],
    },
    {
      key: "agency",
      title: "Agency",
      monthly: formatRange(result.agency, rates.currency),
      typical: result.agency.typical,
      notes: [
        "A team with strategy and account management.",
        "Higher rates, and often project minimums or retainers.",
        "Slower to start; scoped work takes longer to change.",
      ],
    },
    {
      key: "in-house",
      title:
        result.designersNeeded > 1
          ? `In-house (${result.designersNeeded} designers)`
          : "In-house designer",
      monthly: formatMoney(result.inHouse, rates.currency),
      typical: result.inHouse,
      notes: [
        "Always available and learns your brand deeply.",
        "Salary, benefits and equipment, whether or not there is work.",
        "Hiring takes time; one person covers one skill set.",
      ],
    },
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-6 max-[1023px]:grid-cols-1">
      <div className="flex flex-col gap-6">
        <section className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 max-[767px]:p-5">
          <fieldset>
            <legend className="text-lg leading-7 font-semibold">Where is your team?</legend>
            <div className="mt-3 flex gap-2">
              {(
                [
                  { id: "us", label: "United States (USD)" },
                  { id: "eu", label: "Western Europe (EUR)" },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={region === option.id}
                  onClick={() => changeRegion(option.id)}
                  className={`flex h-11 items-center rounded-full border px-4 text-sm font-medium ${
                    region === option.id
                      ? "border-[var(--cs-text)] bg-[var(--cs-text)] text-white"
                      : "border-[var(--cs-border)] bg-[var(--cs-surface)] hover:border-[var(--cs-text)]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 max-[767px]:p-5">
          <h2 className="text-lg leading-7 font-semibold">What do you need each month?</h2>
          <div className="mt-2">
            {DELIVERABLES.map((deliverable) => (
              <Stepper
                key={deliverable.id}
                label={deliverable.name}
                value={inputs.quantities[deliverable.id] ?? 0}
                onChange={(value) => setQuantity(deliverable.id, value)}
              />
            ))}
          </div>
        </section>

        <details className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 max-[767px]:p-5">
          <summary className="cursor-pointer text-lg leading-7 font-semibold">
            Change the rates
          </summary>
          <div className="mt-4 flex flex-col gap-5">
            <MoneyField
              label="Freelancer hourly rate"
              prefix={symbol}
              value={inputs.freelancerHourly}
              onChange={(value) => setInputs((c) => ({ ...c, freelancerHourly: value }))}
              hint={`Typical range ${formatRange(rates.freelancerHourly, rates.currency)} an hour.`}
            />
            <MoneyField
              label="Agency hourly rate"
              prefix={symbol}
              value={inputs.agencyHourly}
              onChange={(value) => setInputs((c) => ({ ...c, agencyHourly: value }))}
              hint={`Typical range ${formatRange(rates.agencyHourly, rates.currency)} an hour.`}
            />
            <MoneyField
              label="In-house designer salary (per year)"
              prefix={symbol}
              value={inputs.inHouseSalary}
              onChange={(value) => setInputs((c) => ({ ...c, inHouseSalary: value }))}
              hint={`We add ${Math.round((inputs.employerCostMultiplier - 1) * 100)}% for benefits, taxes and equipment.`}
            />
            <button
              type="button"
              className={`self-start ${studioButtonClasses("tertiary")}`}
              onClick={() => setInputs((c) => defaultInputs(region, c.quantities))}
            >
              Reset to market rates
            </button>
          </div>
        </details>
      </div>

      <section
        aria-labelledby="cost-results"
        aria-live="polite"
        className="sticky top-6 flex flex-col gap-4 max-[1023px]:static"
      >
        <div className="rounded-2xl border border-[var(--cs-border)] bg-[var(--cs-surface)] p-6 max-[767px]:p-5">
          <h2 id="cost-results" className="text-lg leading-7 font-semibold">
            Your monthly design cost
          </h2>
          <p className="mt-1 text-sm leading-5 text-[var(--cs-muted)]">
            {hasWork
              ? `About ${Math.round(result.hours.typical)} hours of design a month (${Math.round(result.hours.low)}–${Math.round(result.hours.high)}).`
              : "Add some work on the left to see the cost."}
          </p>
          {hasWork ? (
            <ul className="mt-4 flex flex-col gap-3">
              {options.map((option) => (
                <li
                  key={option.key}
                  className="rounded-xl border border-[var(--cs-border)] bg-[var(--cs-background)] p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-base leading-6 font-semibold">{option.title}</h3>
                    <p className="text-xl leading-7 font-bold">
                      {option.monthly}
                      <span className="text-sm font-medium text-[var(--cs-muted)]"> /month</span>
                    </p>
                  </div>
                  <p className="mt-0.5 text-sm text-[var(--cs-muted)]">
                    About {formatMoney(option.typical * 12, rates.currency)} a year
                  </p>
                  <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm leading-5">
                    {option.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : null}
          {hasWork && result.hours.typical < PRODUCTIVE_HOURS_PER_MONTH / 2 ? (
            <p className="mt-3 text-sm leading-5">
              That&apos;s less than half of one designer&apos;s month, so a full-time hire would sit
              idle much of the time.
            </p>
          ) : null}
        </div>
        <div className="rounded-2xl bg-[var(--cs-soft)] p-6">
          <h3 className="text-lg leading-7 font-semibold">
            Or one subscription.{" "}
            <span className="text-[var(--cs-soft-text)]">No hiring, no hourly bills.</span>
          </h3>
          <p className="mt-2 text-sm leading-6">
            brandbite gives you a creative team for a flat monthly plan you can pause anytime. See
            how it compares for your workload.
          </p>
          <Link href="/meet" className={`mt-4 ${studioButtonClasses("primary")}`}>
            Talk to us
            <ArrowRightIcon />
          </Link>
        </div>
      </section>
    </div>
  );
}
