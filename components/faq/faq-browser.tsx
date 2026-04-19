// -----------------------------------------------------------------------------
// @file: components/faq/faq-browser.tsx
// @purpose: Reusable FAQ UI — category pills + accordion. Shared between the
//           public /faq marketing page and the /customer/faq, /creative/faq
//           dashboard pages.
// -----------------------------------------------------------------------------

"use client";

import { useMemo, useState } from "react";

import { FAQ_CATEGORIES, FAQS, type Faq, type FaqCategory } from "@/lib/faq-data";

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
            key={`${faq.category}-${faq.q}`}
            className="overflow-hidden rounded-xl border border-[var(--bb-border)] bg-white"
          >
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-semibold text-[var(--bb-secondary)] transition-colors hover:bg-[var(--bb-bg-page)]"
              aria-expanded={isOpen}
            >
              <span className="flex items-center gap-2">
                <span className="text-[var(--bb-primary)]">+</span>
                {faq.q}
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
                <p className="text-sm font-semibold text-[var(--bb-primary)]">{faq.q}</p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--bb-text-secondary)]">
                  {faq.a}
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
  /** Restrict which categories the user sees. Defaults to all. */
  categories?: readonly FaqCategory[];
};

export function FaqBrowser({ categories = FAQ_CATEGORIES }: FaqBrowserProps) {
  const [activeCategory, setActiveCategory] = useState<FaqCategory>("All");

  const visibleFaqs = useMemo(
    () =>
      activeCategory === "All"
        ? FAQS.filter((f) => categories.includes(f.category as FaqCategory))
        : FAQS.filter((f) => f.category === activeCategory),
    [activeCategory, categories],
  );

  return (
    <div>
      <div className="mb-10 flex flex-wrap justify-center gap-2">
        {categories.map((cat) => (
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
