// -----------------------------------------------------------------------------
// @file: components/dashboard/help/faq-explorer.tsx
// @purpose: Dashboard FAQ: search, category chips, a short question list and one
//           selected answer. Reads /api/faq, on
//           /customer/faq and /creative/faq.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { IconChevronDown } from "@/components/admin/v2/icons";
import {
  Badge,
  Button,
  Callout,
  Card,
  EmptyState,
  FilterChips,
  IconTile,
  plural,
  SearchInput,
  Skeleton,
} from "@/components/admin/v2/ui";
import { IconFaq } from "@/components/navigation/nav-icons";
import { ListPager } from "@/components/dashboard/workspace/list-pager";

type Faq = { id: string; question: string; answer: string; category: string };
type FaqData = { faqs: Faq[]; categories: string[] };

const ALL = "All";
const PAGE_SIZE = 6;

function Answer({ faq }: { faq: Faq }) {
  return <p className="text-base leading-7 whitespace-pre-line">{faq.answer}</p>;
}

export function FaqExplorer({
  categories: categoryRestriction,
  footer,
}: {
  /** Limit the categories shown, e.g. ["General", "Creative Process"]. */
  categories?: readonly string[];
  /** Links shown next to the pager. */
  footer?: ReactNode;
}) {
  const [data, setData] = useState<FaqData | null>(null);
  const [failed, setFailed] = useState(false);
  const [category, setCategory] = useState(ALL);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/faq")
      .then((res) => {
        if (!res.ok) throw new Error(`/api/faq returned ${res.status}`);
        return res.json();
      })
      .then((json: FaqData) => {
        if (cancelled) return;
        setData({
          faqs: Array.isArray(json.faqs) ? json.faqs : [],
          categories: Array.isArray(json.categories) ? json.categories : [],
        });
      })
      .catch((err) => {
        console.error("[FaqExplorer] failed to load", err);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const allowed = useMemo(() => {
    const faqs = data?.faqs ?? [];
    return categoryRestriction
      ? faqs.filter((f) => categoryRestriction.includes(f.category))
      : faqs;
  }, [data, categoryRestriction]);

  const chipOptions = useMemo(() => {
    const fromApi = data?.categories ?? [];
    const visible = categoryRestriction
      ? fromApi.filter((c) => categoryRestriction.includes(c))
      : fromApi;
    return [ALL, ...visible].map((c) => ({ value: c, label: c }));
  }, [data, categoryRestriction]);

  const matches = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return allowed.filter((f) => {
      if (category !== ALL && f.category !== category) return false;
      const text = `${f.question} ${f.answer}`.toLowerCase();
      return terms.every((t) => text.includes(t));
    });
  }, [allowed, category, query]);

  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const pageItems = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selected = pageItems.find((f) => f.id === selectedId) ?? pageItems[0] ?? null;

  // A changed list starts again from its first page and first question, so the
  // highlighted row and the answer panel always show the same record.
  const resetSelection = () => {
    setPage(1);
    setSelectedId(null);
  };

  if (failed) {
    return (
      <Callout tone="error" title="We couldn't load the questions">
        Please refresh the page to try again.
      </Callout>
    );
  }

  if (!data) {
    return (
      <div aria-busy="true" aria-label="Loading questions" className="space-y-6">
        <Skeleton className="h-10" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (allowed.length === 0) {
    return (
      <Card padding="none">
        <EmptyState title="No questions to show right now." />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div role="search">
        <SearchInput
          value={query}
          onChange={(v) => {
            setQuery(v);
            resetSelection();
          }}
          label="Search questions"
          placeholder="Search questions or keywords"
        />
      </div>

      <FilterChips
        label="Question category"
        options={chipOptions}
        value={category}
        onChange={(c) => {
          setCategory(c);
          resetSelection();
        }}
      />

      {matches.length === 0 ? (
        <Card padding="none">
          <EmptyState
            title="No questions match"
            description="Try a different word, or look in another category."
            action={
              <Button
                onClick={() => {
                  setQuery("");
                  setCategory(ALL);
                  resetSelection();
                }}
              >
                Clear filters
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <Card padding="sm">
            <p role="status" className="px-2 pt-1 pb-3 text-sm font-semibold">
              {matches.length} {plural(matches.length, "question", "questions")}
            </p>
            <ul className="space-y-1">
              {pageItems.map((faq) => {
                const active = faq.id === selected?.id;
                return (
                  <li key={faq.id}>
                    <button
                      type="button"
                      aria-current={active ? "true" : undefined}
                      onClick={() => setSelectedId(faq.id)}
                      className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[var(--av2-accent)] focus-visible:outline-none ${
                        active
                          ? "bg-[var(--av2-selected)] text-[var(--av2-link)]"
                          : "hover:bg-[var(--av2-bg)]"
                      }`}
                    >
                      <span className="min-w-0 break-words">{faq.question}</span>
                      <IconChevronDown
                        aria-hidden
                        className={`shrink-0 lg:-rotate-90 ${active ? "" : "max-lg:-rotate-90"}`}
                      />
                    </button>
                    {/* Below lg the answer sits under its question, not a screen away. */}
                    {active && (
                      <div className="px-3 py-3 lg:hidden">
                        <Answer faq={faq} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          {selected && (
            <Card className="hidden lg:sticky lg:top-24 lg:block">
              <div className="flex items-start gap-4">
                <IconTile tone="peach">
                  <IconFaq width={22} height={22} />
                </IconTile>
                <div className="min-w-0 flex-1">
                  <Badge tone="peach">{selected.category}</Badge>
                  <h2 className="mt-2 text-2xl leading-8 font-bold tracking-tight">
                    {selected.question}
                  </h2>
                </div>
              </div>
              <div className="mt-5">
                <Answer faq={selected} />
              </div>
            </Card>
          )}
        </div>
      )}

      {(footer || pageCount > 1) && (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">{footer}</div>
          <ListPager
            label="Question pages"
            page={page}
            pageCount={pageCount}
            onPage={(p) => {
              setPage(p);
              setSelectedId(null);
            }}
          />
        </div>
      )}
    </div>
  );
}
