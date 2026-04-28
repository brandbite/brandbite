// -----------------------------------------------------------------------------
// @file: components/faq/faq-browser.tsx
// @purpose: Reusable FAQ UI — category pills + accordion. Shared between the
//           public /faq marketing page and the /customer/faq, /creative/faq
//           dashboard pages.
//
//           Reads from the central /api/faq endpoint. The previously
//           hardcoded FAQS constant in lib/faq-data.ts moved into the
//           Faq DB table — admin CRUD lands in a follow-up.
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useMemo, useState } from "react";

type Faq = { id: string; question: string; answer: string; category: string };

type FaqApiResponse = { faqs: Faq[]; categories: string[] };

const ALL_LABEL = "All";

type FaqAccordionProps = {
  faqs: Faq[];
};

function FaqAccordion({ faqs }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {faqs.map((faq, i) => {
        const isOpen = openIndex === i;
        return (
          <div
            key={faq.id}
            // bg-[var(--bb-bg-card)] — theme-aware. Was a literal `bg-white`,
            // which broke in the dashboard's dark mode: the text colours
            // flipped to light via CSS variables but the literal white bg
            // stayed white, producing light-on-light invisible text.
            className="overflow-hidden rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-card)]"
          >
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-semibold text-[var(--bb-secondary)] transition-colors hover:bg-[var(--bb-bg-page)]"
              aria-expanded={isOpen}
            >
              <span className="flex items-center gap-2">
                <span className="text-[var(--bb-primary)]">+</span>
                {faq.question}
              </span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`flex-shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {isOpen && (
              <div className="border-t border-[var(--bb-border-subtle)] px-5 py-4">
                <p className="text-sm font-semibold text-[var(--bb-primary)]">{faq.question}</p>
                <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-[var(--bb-text-secondary)]">
                  {faq.answer}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

type FaqBrowserProps = {
  /** Restrict which categories the user can filter by. Defaults to whatever
   *  the API returns. Pass an explicit list to scope, e.g. ["General",
   *  "Pricing & Billing"]. */
  categories?: readonly string[];
};

export function FaqBrowser({ categories: categoryRestriction }: FaqBrowserProps) {
  const [data, setData] = useState<FaqApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>(ALL_LABEL);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/faq")
      .then((res) => {
        if (!res.ok) throw new Error(`/api/faq returned ${res.status}`);
        return res.json();
      })
      .then((json: FaqApiResponse) => {
        if (cancelled) return;
        setData({
          faqs: Array.isArray(json.faqs) ? json.faqs : [],
          categories: Array.isArray(json.categories) ? json.categories : [],
        });
      })
      .catch((err) => {
        console.error("[FaqBrowser] failed to load", err);
        if (cancelled) return;
        setData({ faqs: [], categories: [] });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The pill list = "All" plus the API-returned categories, optionally
  // intersected with the caller's restriction. Done with useMemo so the
  // pill row doesn't reflow when the accordion re-renders.
  const visibleCategories = useMemo<string[]>(() => {
    const fromApi = data?.categories ?? [];
    const allowed = categoryRestriction
      ? fromApi.filter((c) => categoryRestriction.includes(c))
      : fromApi;
    return [ALL_LABEL, ...allowed];
  }, [data?.categories, categoryRestriction]);

  const visibleFaqs = useMemo<Faq[]>(() => {
    if (!data) return [];
    const allowed = categoryRestriction
      ? data.faqs.filter((f) => categoryRestriction.includes(f.category))
      : data.faqs;
    if (activeCategory === ALL_LABEL) return allowed;
    return allowed.filter((f) => f.category === activeCategory);
  }, [data, activeCategory, categoryRestriction]);

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {/* Three muted skeleton rows. Same height + radius as the real
            accordion items so the page layout doesn't jump when the
            data lands. */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-xl border border-[var(--bb-border)] bg-[var(--bb-bg-warm)]"
          />
        ))}
      </div>
    );
  }

  if (!data || data.faqs.length === 0) {
    return (
      <p className="text-center text-sm text-[var(--bb-text-secondary)]">
        No questions to show right now.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-10 flex flex-wrap justify-center gap-2">
        {visibleCategories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
              activeCategory === cat
                ? "bg-[var(--bb-primary)] text-white"
                : "bg-[var(--bb-bg-warm)] text-[var(--bb-text-secondary)] hover:bg-[#eae6f1]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <FaqAccordion faqs={visibleFaqs} />
    </div>
  );
}
