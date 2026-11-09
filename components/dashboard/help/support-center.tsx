// -----------------------------------------------------------------------------
// @file: components/dashboard/help/support-center.tsx
// @purpose: Customer / creative Support home: guide search over the role's guides
//           and one tab per topic. The open topic lives in the URL hash so the
//           guide's "Back" link returns to it. /admin/support keeps SupportHub.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  buttonClass,
  Card,
  EmptyState,
  IconTile,
  PageHeader,
  SearchInput,
  TabPanel,
  Tabs,
} from "@/components/admin/v2/ui";
import {
  getGuides,
  groupGuides,
  guideHref,
  popularGuides,
  searchGuides,
  type SupportGuide,
} from "@/lib/support";

import { guideIcon, guideTone, type HelpRole, StillStuckText, toAnchor } from "./guide-meta";

const INTRO: Record<HelpRole, string> = {
  customer: "Step-by-step help for every part of your brandbite dashboard.",
  creative: "Step-by-step help for every part of your creative dashboard.",
};

const SEARCH_HINT: Record<HelpRole, string> = {
  customer: "Search guides, e.g. “tokens” or “invite a member”",
  creative: "Search guides, e.g. “withdrawal” or “revision”",
};

const ID_PREFIX = "support-topic";

function GuideGrid({ role, guides }: { role: HelpRole; guides: SupportGuide[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {guides.map((g, i) => (
        <li key={g.slug} className="min-w-0">
          <Link
            href={guideHref(role, g.slug)}
            className="flex h-full gap-4 rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-5 transition-colors hover:border-[var(--av2-accent)]/50 focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:ring-offset-1 focus-visible:outline-none"
          >
            <IconTile tone={guideTone(i)}>{guideIcon(g.slug)}</IconTile>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-lg leading-6 font-semibold">{g.title}</span>
              <span className="mt-1.5 flex-1 text-sm leading-5 text-[var(--av2-text-2)]">
                {g.summary}
              </span>
              <span className="mt-3 text-sm font-semibold text-[var(--av2-link)]">
                Read guide <span aria-hidden>→</span>
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function SupportCenter({
  role,
  guides: source,
}: {
  role: HelpRole;
  /** The role's guides with the CMS layer applied; code guides when absent. */
  guides?: SupportGuide[];
}) {
  const guides = useMemo(() => getGuides(role, { source }), [role, source]);
  const groups = useMemo(() => groupGuides(role, guides), [role, guides]);
  const popular = useMemo(() => popularGuides(role, { source }), [role, source]);
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState(groups[0]?.category ?? "");

  const results = useMemo(() => searchGuides(guides, query), [guides, query]);
  const searching = query.trim().length > 0;

  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    const match = groups.find((g) => toAnchor(g.category) === hash);
    if (match) setTopic(match.category);
  }, [groups]);

  const chooseTopic = (category: string) => {
    setTopic(category);
    window.history.replaceState(null, "", `#${toAnchor(category)}`);
  };

  const activeGroup = groups.find((g) => g.category === topic) ?? groups[0];

  return (
    <>
      <PageHeader title="Support" description={INTRO[role]} />

      <div role="search" className="mb-6">
        <SearchInput
          value={query}
          onChange={setQuery}
          label="Search support guides"
          placeholder={SEARCH_HINT[role]}
        />
      </div>

      {searching ? (
        <section aria-live="polite">
          {results.length === 0 ? (
            <Card padding="none">
              <EmptyState
                title="No guides match your search"
                description={
                  <>
                    Try a different word, or <StillStuckText />
                  </>
                }
              />
            </Card>
          ) : (
            <>
              <h2 className="mb-3 text-sm font-semibold text-[var(--av2-text-2)]">
                {results.length} {results.length === 1 ? "guide" : "guides"} found
              </h2>
              <GuideGrid role={role} guides={results} />
            </>
          )}
        </section>
      ) : (
        <>
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold">Popular guides</h2>
            <GuideGrid role={role} guides={popular} />
          </section>
          <Tabs
            label="Support topics"
            idPrefix={ID_PREFIX}
            tabs={groups.map((g) => ({ value: g.category, label: g.category }))}
            value={activeGroup?.category ?? ""}
            onChange={chooseTopic}
          />
          {activeGroup && (
            <div className="mt-6">
              <TabPanel idPrefix={ID_PREFIX} value={activeGroup.category}>
                <GuideGrid role={role} guides={activeGroup.items} />
              </TabPanel>
            </div>
          )}
        </>
      )}

      <section className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--av2-attention-border)] bg-gradient-to-r from-[var(--av2-attention-from)] to-[var(--av2-attention-to)] p-6">
        <div className="min-w-[240px] flex-1">
          <h2 className="text-xl leading-7 font-semibold">Still stuck?</h2>
          <p className="mt-0.5 text-sm text-[var(--av2-text-2)]">
            <StillStuckText />
          </p>
        </div>
        <Link href={`/${role}/faq`} className={buttonClass("secondary")}>
          Read the FAQ
        </Link>
      </section>
    </>
  );
}
