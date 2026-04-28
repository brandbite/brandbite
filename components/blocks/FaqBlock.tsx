// -----------------------------------------------------------------------------
// @file: components/blocks/FaqBlock.tsx
// @purpose: Public-facing FAQ accordion block. Renders a list of
//           question/answer pairs in a single-open-at-a-time accordion,
//           preceded by an optional title + subtitle.
//
//           Matches the visual look of the previously-hardcoded
//           FaqSection on the landing page so swapping in the
//           DB-driven version changes nothing visitors can see when
//           the data matches the defaults.
// -----------------------------------------------------------------------------
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-04-28
// -----------------------------------------------------------------------------

"use client";

import { useState } from "react";

import type { FaqData } from "@/lib/blocks/types";

type FaqBlockProps = {
  data: FaqData;
};

export function FaqBlock({ data }: FaqBlockProps) {
  // Open the second item by default to hint that the accordion is
  // interactive without scaring people with everything-collapsed. If
  // there's only one Q&A, open it.
  const [openIndex, setOpenIndex] = useState<number | null>(data.qas.length > 1 ? 1 : 0);

  const title = data.title ?? "FAQ";
  const subtitle = data.subtitle ?? "Frequently asked questions.";

  return (
    <section id="faq" className="bg-[var(--bb-bg-page)] px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-2xl">
        <h2 className="font-brand text-3xl font-bold tracking-tight">{title}</h2>
        {subtitle ? (
          <p className="mt-1 mb-10 text-sm text-[var(--bb-text-secondary)]">{subtitle}</p>
        ) : (
          <div className="mb-10" />
        )}

        <div className="space-y-3">
          {data.qas.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
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
                    className={`flex-shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="border-t border-[var(--bb-border-subtle)] px-5 py-4">
                    <p className="text-sm font-semibold text-[var(--bb-primary)]">{faq.q}</p>
                    <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-[var(--bb-text-secondary)]">
                      {faq.a}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
