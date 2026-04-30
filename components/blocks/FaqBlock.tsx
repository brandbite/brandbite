// -----------------------------------------------------------------------------
// @file: components/blocks/FaqBlock.tsx
// @purpose: Public-facing FAQ accordion block. Reads the picker selection
//           from `data.selectedFaqIds` and joins against /api/faq to render
//           the actual question/answer content.
//
//           Empty selection = fallback to the first N active FAQs so a
//           landing page that hasn't been curated yet still shows
//           something sensible (the central FAQ store is the source of
//           truth either way).
// -----------------------------------------------------------------------------
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-04-30
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { DEFAULT_FAQ_FALLBACK_LIMIT } from "@/lib/blocks/defaults";
import type { FaqData } from "@/lib/blocks/types";

type FaqBlockProps = {
  data: FaqData;
};

type CentralFaq = { id: string; question: string; answer: string; category: string };

type FaqApiResponse = { faqs: CentralFaq[]; categories?: string[] };

export function FaqBlock({ data }: FaqBlockProps) {
  const [allFaqs, setAllFaqs] = useState<CentralFaq[] | null>(null);

  // Open the second item by default to hint that the accordion is
  // interactive without scaring people with everything-collapsed. If
  // there's only one Q&A, open it.
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/faq")
      .then((res) => {
        if (!res.ok) throw new Error(`/api/faq returned ${res.status}`);
        return res.json();
      })
      .then((json: FaqApiResponse) => {
        if (cancelled) return;
        setAllFaqs(Array.isArray(json.faqs) ? json.faqs : []);
      })
      .catch((err) => {
        console.error("[FaqBlock] failed to load central FAQs", err);
        if (cancelled) return;
        setAllFaqs([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Resolve the rendered list. If the admin picked specific IDs, render
  // those in the order they were picked. If none are picked, fall back
  // to the first N from the central store so the section never renders
  // empty out of the box.
  const visibleFaqs = useMemo<CentralFaq[]>(() => {
    if (!allFaqs) return [];
    if (data.selectedFaqIds.length === 0) {
      return allFaqs.slice(0, DEFAULT_FAQ_FALLBACK_LIMIT);
    }
    const byId = new Map(allFaqs.map((f) => [f.id, f] as const));
    const picked: CentralFaq[] = [];
    for (const id of data.selectedFaqIds) {
      const found = byId.get(id);
      if (found) picked.push(found);
      // Silently skip IDs that no longer exist in the store (e.g. an
      // admin deleted a FAQ from /admin/faq without updating the
      // landing-page picker). The block remains valid; the deleted
      // entry just disappears.
    }
    return picked;
  }, [allFaqs, data.selectedFaqIds]);

  // Defensive bound — if the picked-IDs list shrinks below the currently
  // open index (e.g. admin removed an item and the API came back smaller),
  // pretend nothing is open. Doing this at render time instead of via a
  // setState effect avoids a re-render cycle and the corresponding
  // `react-hooks/set-state-in-effect` lint warning.
  const safeOpenIndex = openIndex !== null && openIndex < visibleFaqs.length ? openIndex : null;

  const title = data.title ?? "FAQ";
  const subtitle = data.subtitle ?? "Frequently asked questions.";

  // Loading state: skeleton with the same outer dimensions as the real
  // accordion so the page doesn't jump when content lands.
  if (allFaqs === null) {
    return (
      <section id="faq" className="bg-[var(--bb-bg-page)] px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-2xl">
          <h2 className="font-brand text-3xl font-bold tracking-tight">{title}</h2>
          {subtitle ? (
            <p className="mt-1 mb-10 text-sm text-[var(--bb-text-secondary)]">{subtitle}</p>
          ) : (
            <div className="mb-10" />
          )}
          <div className="space-y-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-xl border border-[var(--bb-border)] bg-white"
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (visibleFaqs.length === 0) {
    return (
      <section id="faq" className="bg-[var(--bb-bg-page)] px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-2xl">
          <h2 className="font-brand text-3xl font-bold tracking-tight">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-[var(--bb-text-secondary)]">{subtitle}</p>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section id="faq" className="bg-[var(--bb-bg-page)] px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-2xl">
        <h2 className="font-brand text-3xl font-bold tracking-tight">{title}</h2>
        {subtitle ? (
          <p className="mt-1 mb-10 text-sm text-[var(--bb-text-secondary)]">{subtitle}</p>
        ) : (
          <div className="mb-10" />
        )}

        <FaqAccordion
          visibleFaqs={visibleFaqs}
          safeOpenIndex={safeOpenIndex}
          setOpenIndex={setOpenIndex}
        />

        <FaqCta data={data} />
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * Accordion sub-component — split out so the CTA can sit in the same parent
 * <div> at the same nesting level without an awkward fragment-with-key.
 * ------------------------------------------------------------------------- */

function FaqAccordion({
  visibleFaqs,
  safeOpenIndex,
  setOpenIndex,
}: {
  visibleFaqs: CentralFaq[];
  safeOpenIndex: number | null;
  setOpenIndex: (idx: number | null) => void;
}) {
  return (
    <div className="space-y-3">
      {visibleFaqs.map((faq, i) => {
        const isOpen = safeOpenIndex === i;
        return (
          <div
            key={faq.id}
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

/* ---------------------------------------------------------------------------
 * "See all questions" CTA below the accordion. Renders only when both
 * label and href are set (the schema enforces them as a pair).
 *
 * Style matches the Showcase section's "View the full gallery" pill and
 * the Why section's "Explore Pricing" button — dark secondary background,
 * white bold text, arrow icon, hover to #333. Keeping section-conclusion
 * CTAs visually consistent across the landing page so visitors recognise
 * the pattern from one section to the next.
 * ------------------------------------------------------------------------- */

function FaqCta({ data }: { data: FaqData }) {
  const label = data.ctaLabel?.trim();
  const href = data.ctaHref?.trim();
  if (!label || !href) return null;

  return (
    <div className="mt-10 flex justify-center">
      <Link
        href={href}
        className="inline-flex items-center gap-1 rounded-full bg-[var(--bb-secondary)] px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#333]"
      >
        {label}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}
