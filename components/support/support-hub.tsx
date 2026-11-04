"use client";

// -----------------------------------------------------------------------------
// @file: components/support/support-hub.tsx
// @purpose: Support home for a dashboard role — search box over the role's
//           guides and the guides grouped by category. Client component so
//           search filters as you type and owner-only admin guides can be
//           hidden from SITE_ADMINs.
// -----------------------------------------------------------------------------

import { useMemo, useState } from "react";
import Link from "next/link";

import { getGuides, groupGuides, guideHref, searchGuides, type SupportRole } from "@/lib/support";
import { useSessionRole } from "@/lib/hooks/use-session-role";

import { SupportScope } from "./support-ui";

const INTRO: Record<SupportRole, string> = {
  customer: "Step-by-step help for every part of your brandbite dashboard.",
  creative: "Step-by-step help for every part of your creative dashboard.",
  admin: "How each admin page works, what its settings do and what to watch out for.",
};

const SEARCH_HINT: Record<SupportRole, string> = {
  customer: "Search guides, e.g. “tokens” or “invite a member”",
  creative: "Search guides, e.g. “withdrawal” or “revision”",
  admin: "Search guides, e.g. “payout rules” or “refund”",
};

export function SupportHub({ role }: { role: SupportRole }) {
  const { isSiteOwner } = useSessionRole();
  const [query, setQuery] = useState("");

  const guides = useMemo(() => getGuides(role, { isSiteOwner }), [role, isSiteOwner]);
  const results = useMemo(() => searchGuides(guides, query), [guides, query]);
  const searching = query.trim().length > 0;
  const groups = useMemo(() => groupGuides(role, guides), [role, guides]);

  return (
    <SupportScope role={role}>
      <header className="mb-6">
        <h1 className="text-[28px] leading-9 font-bold tracking-tight">Support</h1>
        <p className="mt-1 text-base text-[var(--sp-muted)]">{INTRO[role]}</p>
      </header>

      <div role="search" className="mb-8">
        <label htmlFor="support-search" className="sr-only">
          Search support guides
        </label>
        <input
          id="support-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={SEARCH_HINT[role]}
          autoComplete="off"
          className="h-11 w-full rounded-xl border border-[var(--sp-border)] bg-[var(--sp-card)] px-4 text-base text-[var(--sp-text)] placeholder:text-[var(--sp-muted)] focus-visible:border-[var(--sp-accent)] focus-visible:ring-2 focus-visible:ring-[var(--sp-accent)] focus-visible:outline-none"
        />
      </div>

      {searching ? (
        <section aria-live="polite">
          <h2 className="mb-3 text-sm font-semibold text-[var(--sp-muted)]">
            {results.length === 0
              ? "No guides match your search"
              : `${results.length} ${results.length === 1 ? "guide" : "guides"} found`}
          </h2>
          {results.length === 0 ? (
            <p className="text-[15px] leading-7 text-[var(--sp-muted)]">
              Try a different word, or use the feedback button in the bottom-right corner and pick
              “I&rsquo;m not sure how this works”.
            </p>
          ) : (
            <GuideGrid role={role} guides={results} />
          )}
        </section>
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.category}>
              <h2 className="mb-3 text-lg font-bold tracking-tight">{g.category}</h2>
              <GuideGrid role={role} guides={g.items} />
            </section>
          ))}
        </div>
      )}
    </SupportScope>
  );
}

function GuideGrid({ role, guides }: { role: SupportRole; guides: ReturnType<typeof getGuides> }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {guides.map((g) => (
        <li key={g.slug}>
          <Link
            href={guideHref(role, g.slug)}
            className="block h-full rounded-xl border border-[var(--sp-border)] bg-[var(--sp-card)] px-5 py-4 transition-colors hover:bg-[var(--sp-card-hover)] focus-visible:ring-2 focus-visible:ring-[var(--sp-accent)] focus-visible:outline-none"
          >
            <span className="block font-semibold">{g.title}</span>
            <span className="mt-1 block text-sm leading-6 text-[var(--sp-muted)]">{g.summary}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
