// -----------------------------------------------------------------------------
// @file: components/engagement/monthly-recap-card.tsx
// @purpose: "Monthly recap" on the customer overview: last month's delivered
//           requests, tokens used and the estimated agency equivalent, with
//           how the estimate is worked out and a button that copies a
//           one-line summary to share. Loads itself; renders nothing while
//           the owner's switch is off or when nothing was delivered.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";

import { Button, Card, IconTile } from "@/components/admin/v2/ui";
import {
  formatUsd,
  HOW_ESTIMATED,
  recapShareText,
  type MonthlyRecap,
} from "@/lib/engagement/monthly-recap";

function CalendarIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="16" rx="2.500" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

export function MonthlyRecapCard() {
  const howId = useId();
  const [recap, setRecap] = useState<MonthlyRecap | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [showHow, setShowHow] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/customer/monthly-recap", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!live || !json?.enabled || !json.recap) return;
        setRecap(json.recap as MonthlyRecap);
        setCompanyName(typeof json.companyName === "string" ? json.companyName : null);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!recap || recap.jobsDelivered === 0) return null;

  const share = async () => {
    const text = recapShareText(recap, companyName);
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Share sheet dismissed or clipboard blocked: nothing to do.
    }
  };

  const stats: { value: string; label: string }[] = [
    {
      value: String(recap.jobsDelivered),
      label: recap.jobsDelivered === 1 ? "Request delivered" : "Requests delivered",
    },
    { value: String(recap.tokensUsed), label: "Tokens used" },
  ];
  if (recap.agencyEquivalentUsd !== null) {
    stats.push({
      value: `≈ ${formatUsd(recap.agencyEquivalentUsd)}`,
      label: "Est. agency equivalent",
    });
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-4">
        <IconTile tone="green" round>
          <CalendarIcon />
        </IconTile>
        <div className="min-w-[140px] flex-1">
          <h2 className="text-xl leading-7 font-semibold">Monthly recap</h2>
          <p className="text-base text-[var(--av2-text-2)]">{recap.monthLabel}</p>
        </div>
        <Button variant="secondary" onClick={share}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 15V4m0 0L8 8m4-4 4 4M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {copied ? "Copied" : "Share recap"}
        </Button>
        <span className="sr-only" role="status">
          {copied ? "Recap copied to the clipboard" : ""}
        </span>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 sm:divide-x sm:divide-[var(--av2-border)]">
        {stats.map((stat, i) => (
          <div key={stat.label} className={i > 0 ? "sm:pl-6" : undefined}>
            <dd className="text-2xl leading-8 font-bold tabular-nums">{stat.value}</dd>
            <dt className="text-base text-[var(--av2-text-2)]">{stat.label}</dt>
          </div>
        ))}
      </dl>

      {recap.agencyEquivalentUsd !== null ? (
        <div className="mt-4">
          <button
            type="button"
            aria-expanded={showHow}
            aria-controls={howId}
            onClick={() => setShowHow((v) => !v)}
            className="inline-flex min-h-8 items-center gap-2 text-sm font-medium text-[var(--av2-link)] underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none"
          >
            How it&rsquo;s estimated
          </button>
          {showHow ? (
            <p id={howId} className="mt-2 text-sm text-[var(--av2-text-2)]">
              {HOW_ESTIMATED}{" "}
              <Link
                href="/design-cost-calculator"
                className="font-medium text-[var(--av2-link)] underline underline-offset-2"
              >
                Open the cost calculator
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
