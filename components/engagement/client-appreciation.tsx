// -----------------------------------------------------------------------------
// @file: components/engagement/client-appreciation.tsx
// @purpose: A creative's client appreciation: how often customers gave each
//           thank-you tag. A card for the profile page, a panel for the
//           portfolio, and the small chips on portfolio items.
//
//           Everything here renders nothing while the owner's "Customer
//           thank-yous" switch is off (the API answers enabled: false).
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Card, IconTile } from "@/components/admin/v2/ui";
import {
  THANKS_TAG_LABELS,
  THANKS_TAGS,
  type ThanksTag,
  type ThanksTotals,
} from "@/lib/engagement/thanks";

export type Appreciation = {
  totals: ThanksTotals;
  byTicket: Record<string, ThanksTag[]>;
};

/** The creative's appreciation, or null while loading or switched off. */
export function useAppreciation(): Appreciation | null {
  const [data, setData] = useState<Appreciation | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/creative/appreciation", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (live && json?.enabled) setData({ totals: json.totals, byTicket: json.byTicket ?? {} });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return data;
}

const ICON_PATHS: Record<ThanksTag, React.ReactNode> = {
  NAILED_BRIEF: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </>
  ),
  QUICK_TURNAROUND: <path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z" />,
  GREAT_COMMUNICATION: (
    <path d="M20.5 12a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.1-4.2A8.5 8.5 0 1 1 20.5 12z" />
  ),
};

function TagIcon({ tag }: { tag: ThanksTag }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICON_PATHS[tag]}
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20.5s-8-4.9-8-10.6A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 8 2.3c0 5.7-8 10.6-8 10.6z" />
    </svg>
  );
}

const LAVENDER_TEXT = "text-[#4b3fb0] dark:text-[#c3b9fa]";

/** Most-given tag first; the standard order breaks ties. */
function ranked(totals: ThanksTotals): ThanksTag[] {
  return [...THANKS_TAGS].sort((a, b) => totals[b] - totals[a]);
}

/** Profile page: a row per tag with its count. */
export function ClientAppreciationCard({ appreciation }: { appreciation: Appreciation | null }) {
  if (!appreciation) return null;
  const { totals } = appreciation;
  return (
    <Card>
      <h2 className="text-xl leading-7 font-semibold">Client appreciation</h2>
      <p className="mt-1 text-sm text-[var(--av2-text-2)]">
        Thank-yous from customers on work they approved.
      </p>
      <ul className="mt-4 divide-y divide-[var(--av2-border)]">
        {THANKS_TAGS.map((tag) => (
          <li key={tag} className="flex items-center gap-4 py-2.5">
            <IconTile tone="lavender">
              <TagIcon tag={tag} />
            </IconTile>
            <span className="min-w-0 flex-1 text-base">{THANKS_TAG_LABELS[tag]}</span>
            <span
              className={`rounded-full bg-[var(--av2-lavender-bg)] px-3.5 py-1 text-base font-semibold tabular-nums ${LAVENDER_TEXT}`}
            >
              {totals[tag]}
              <span className="sr-only"> {totals[tag] === 1 ? "time" : "times"}</span>
            </span>
          </li>
        ))}
      </ul>
      <Link
        href="/creative/portfolio"
        className="mt-3 inline-flex items-center gap-1.5 text-base font-medium text-[var(--av2-link)] underline underline-offset-2"
      >
        View portfolio <span aria-hidden>→</span>
      </Link>
    </Card>
  );
}

/** Portfolio page: lavender rows, most-given first. */
export function ClientAppreciationPanel({ appreciation }: { appreciation: Appreciation | null }) {
  if (!appreciation) return null;
  const { totals } = appreciation;
  const any = THANKS_TAGS.some((tag) => totals[tag] > 0);
  return (
    <Card>
      <div className="flex items-center gap-4">
        <IconTile tone="lavender">
          <HeartIcon />
        </IconTile>
        <h2 className="text-xl leading-7 font-semibold">Client appreciation</h2>
      </div>
      {any ? (
        <ul className="mt-4 space-y-2.5">
          {ranked(totals)
            .filter((tag) => totals[tag] > 0)
            .map((tag) => (
              <li
                key={tag}
                className={`flex items-center gap-3 rounded-xl bg-[var(--av2-lavender-bg)] px-4 py-3 text-base font-semibold ${LAVENDER_TEXT}`}
              >
                <TagIcon tag={tag} />
                <span>
                  {THANKS_TAG_LABELS[tag]} <span aria-hidden>·</span>{" "}
                  <span className="tabular-nums">{totals[tag]}</span>
                </span>
              </li>
            ))}
        </ul>
      ) : (
        <p className="mt-3 text-base text-[var(--av2-text-2)]">
          When a customer thanks you on an approved request, it shows up here.
        </p>
      )}
    </Card>
  );
}

/** The thank-you tags a customer gave on one request. */
export function ThanksChips({ tags }: { tags: ThanksTag[] | undefined }) {
  if (!tags || tags.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Customer thank-yous">
      {tags.map((tag) => (
        <li
          key={tag}
          className={`rounded-full bg-[var(--av2-lavender-bg)] px-3 py-1 text-sm font-medium ${LAVENDER_TEXT}`}
        >
          {THANKS_TAG_LABELS[tag]}
        </li>
      ))}
    </ul>
  );
}
