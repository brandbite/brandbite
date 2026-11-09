// -----------------------------------------------------------------------------
// @file: components/dashboard/help/support-center.tsx
// @purpose: Support home for every dashboard (customer, creative, admin):
//           guide search, popular guides as cards, then one pill per topic
//           over a paged list of that topic's guides. The open topic lives in
//           the URL hash so a guide's "All guides" link returns to it.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  Badge,
  buttonClass,
  Card,
  EmptyState,
  IconTile,
  PageHeader,
  SearchInput,
} from "@/components/admin/v2/ui";
import {
  getGuides,
  groupGuides,
  guideHref,
  hasVisual,
  popularGuides,
  searchGuides,
  type SupportGuide,
  type SupportRole,
} from "@/lib/support";

import { guideIcon, guideTone, StillStuckText, toAnchor } from "./guide-meta";
import { IconChevronRight, IconImage } from "@/components/admin/v2/icons";

const INTRO: Record<SupportRole, string> = {
  customer: "Step-by-step help for every part of your brandbite dashboard.",
  creative: "Step-by-step help for every part of your creative dashboard.",
  admin: "Find out how each admin page works.",
};

const SEARCH_HINT: Record<SupportRole, string> = {
  customer: "Search guides, e.g. tokens or invite a member",
  creative: "Search guides, e.g. withdrawal or revision",
  admin: "Search guides, e.g. payout rules or refund",
};

/** Guides per page in a topic's list. */
export const PAGE_SIZE = 6;

const FOCUS =
  "focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:ring-offset-1 focus-visible:outline-none";

function PopularCards({ role, guides }: { role: SupportRole; guides: SupportGuide[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {guides.map((g, i) => (
        <li key={g.slug} className="min-w-0">
          <Link
            href={guideHref(role, g.slug)}
            className={`flex h-full gap-4 rounded-2xl border border-[var(--av2-border)] bg-[var(--av2-surface)] p-5 transition-colors hover:border-[var(--av2-accent)]/50 ${FOCUS}`}
          >
            <IconTile tone={guideTone(i)}>{guideIcon(g.slug, role)}</IconTile>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-base leading-6 font-semibold">{g.title}</span>
              <span className="mt-1.5 text-sm leading-5 text-[var(--av2-text-2)]">{g.summary}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** One guide per row: title (and a "Visual guide" badge), summary, chevron. */
function GuideRows({ role, guides }: { role: SupportRole; guides: SupportGuide[] }) {
  return (
    <ul className="divide-y divide-[var(--av2-border)]">
      {guides.map((g) => (
        <li key={g.slug}>
          <Link
            href={guideHref(role, g.slug)}
            className={`group flex items-center gap-4 rounded-lg px-2 py-4 transition-colors hover:bg-[var(--av2-bg)] ${FOCUS}`}
          >
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-base leading-6 font-semibold">{g.title}</span>
                {hasVisual(g) && (
                  <Badge icon={<IconImage width={14} height={14} />}>Visual guide</Badge>
                )}
              </span>
              <span className="mt-1 block text-sm leading-5 text-[var(--av2-text-2)]">
                {g.summary}
              </span>
            </span>
            <IconChevronRight
              aria-hidden
              className="shrink-0 text-[var(--av2-text-2)] transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function PageButtons({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  const arrow = "h-10 w-10 px-0!";
  return (
    <nav aria-label="Guide pages" className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className={`${buttonClass("secondary")} ${arrow}`}
      >
        <IconChevronRight aria-hidden className="rotate-180" />
      </button>
      {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`Page ${n}`}
          aria-current={n === page ? "page" : undefined}
          onClick={() => onPage(n)}
          className={`${buttonClass("secondary")} ${arrow} ${
            n === page
              ? "border-[var(--av2-attention-border)] bg-[var(--av2-selected)] text-[var(--av2-link)] hover:bg-[var(--av2-selected)]"
              : ""
          }`}
        >
          {n}
        </button>
      ))}
      <button
        type="button"
        aria-label="Next page"
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
        className={`${buttonClass("secondary")} ${arrow}`}
      >
        <IconChevronRight aria-hidden />
      </button>
    </nav>
  );
}

export function SupportCenter({
  role,
  guides: source,
  isSiteOwner = false,
}: {
  role: SupportRole;
  /** The role's guides with the CMS layer applied; code guides when absent. */
  guides?: SupportGuide[];
  /** Admin only: owner-only guides are listed for site owners. */
  isSiteOwner?: boolean;
}) {
  const opts = useMemo(() => ({ source, isSiteOwner }), [source, isSiteOwner]);
  const guides = useMemo(() => getGuides(role, opts), [role, opts]);
  const groups = useMemo(() => groupGuides(role, guides), [role, guides]);
  const popular = useMemo(() => popularGuides(role, opts), [role, opts]);
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState(groups[0]?.category ?? "");
  const [page, setPage] = useState(1);

  const results = useMemo(() => searchGuides(guides, query), [guides, query]);
  const searching = query.trim().length > 0;

  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    const match = groups.find((g) => toAnchor(g.category) === hash);
    if (match) setTopic(match.category);
  }, [groups]);

  const chooseTopic = (category: string) => {
    setTopic(category);
    setPage(1);
    window.history.replaceState(null, "", `#${toAnchor(category)}`);
  };

  const activeGroup = groups.find((g) => g.category === topic) ?? groups[0];
  const items = activeGroup?.items ?? [];
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const shownPage = Math.min(page, pageCount);
  const first = (shownPage - 1) * PAGE_SIZE;
  const pageItems = items.slice(first, first + PAGE_SIZE);

  return (
    <>
      <PageHeader title="Support" description={INTRO[role]} />

      <div role="search" className="mb-10">
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
            <Card>
              <h2 className="text-xl leading-7 font-semibold">
                {results.length} {results.length === 1 ? "guide" : "guides"} found
              </h2>
              <div className="mt-2">
                <GuideRows role={role} guides={results} />
              </div>
            </Card>
          )}
        </section>
      ) : (
        <>
          {popular.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-4 text-xl leading-7 font-semibold">Popular guides</h2>
              <PopularCards role={role} guides={popular} />
            </section>
          )}

          <section aria-labelledby="browse-guides">
            <h2 id="browse-guides" className="mb-4 text-xl leading-7 font-semibold">
              Browse guides
            </h2>
            <div role="group" aria-label="Topics" className="mb-6 flex flex-wrap gap-2">
              {groups.map((g) => {
                const active = g.category === activeGroup?.category;
                return (
                  <button
                    key={g.category}
                    type="button"
                    aria-pressed={active}
                    onClick={() => chooseTopic(g.category)}
                    className={`inline-flex h-10 items-center rounded-full border px-5 text-sm font-semibold transition-colors ${FOCUS} ${
                      active
                        ? "border-[var(--av2-attention-border)] bg-[var(--av2-selected)] text-[var(--av2-link)]"
                        : "border-[var(--av2-border)] bg-[var(--av2-surface)] hover:bg-[var(--av2-bg)]"
                    }`}
                  >
                    {g.category}
                  </button>
                );
              })}
            </div>

            {activeGroup && (
              <Card>
                <h3 className="text-2xl leading-8 font-semibold">{activeGroup.category}</h3>
                <p className="mt-0.5 text-sm text-[var(--av2-text-2)]">
                  {items.length} {items.length === 1 ? "guide" : "guides"}
                </p>
                <div className="mt-3">
                  <GuideRows role={role} guides={pageItems} />
                </div>
                {pageCount > 1 && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--av2-border)] pt-4">
                    <p className="text-sm text-[var(--av2-text-2)]" aria-live="polite">
                      Showing {first + 1}–{first + pageItems.length} of {items.length}
                    </p>
                    <PageButtons page={shownPage} pageCount={pageCount} onPage={setPage} />
                  </div>
                )}
              </Card>
            )}
          </section>
        </>
      )}

      <section className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--av2-attention-border)] bg-gradient-to-r from-[var(--av2-attention-from)] to-[var(--av2-attention-to)] p-6">
        <div className="min-w-[240px] flex-1">
          <h2 className="text-xl leading-7 font-semibold">Still stuck?</h2>
          <p className="mt-0.5 text-sm text-[var(--av2-text-2)]">
            <StillStuckText />
          </p>
        </div>
        {role !== "admin" && (
          <Link href={`/${role}/faq`} className={buttonClass("secondary")}>
            Read the FAQ
          </Link>
        )}
      </section>
    </>
  );
}
