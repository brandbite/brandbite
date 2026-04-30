// -----------------------------------------------------------------------------
// @file: components/blocks/CallToActionBlock.tsx
// @purpose: Public-facing full-width conversion band. Headline + optional
//           subhead + brand-primary CTA pill, centered on a cream
//           background that visually separates the band from the
//           surrounding white sections.
//
//           Style matches the "Still have questions?" CTA at the bottom
//           of /faq — same `bg-[var(--bb-bg-warm)]` band, same
//           brand-primary pill button as the hero. Used by app/page.tsx
//           PageBlock-driven CallToActionSection but suitable for any
//           page that wants a conversion moment between sections.
// -----------------------------------------------------------------------------
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-04-30
// -----------------------------------------------------------------------------

import Link from "next/link";

import type { CallToActionData } from "@/lib/blocks/types";

type CallToActionBlockProps = {
  data: CallToActionData;
};

export function CallToActionBlock({ data }: CallToActionBlockProps) {
  return (
    <section className="bg-[var(--bb-bg-warm)] px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-brand text-2xl font-bold tracking-tight text-[var(--bb-secondary)] sm:text-3xl">
          {data.headline}
        </h2>
        {data.subhead ? (
          <p className="mt-3 text-base text-[var(--bb-text-secondary)]">{data.subhead}</p>
        ) : null}
        <div className="mt-8">
          <Link
            href={data.ctaHref}
            className="inline-block rounded-full bg-[var(--bb-primary)] px-8 py-3.5 text-sm font-bold tracking-wide text-white uppercase shadow-[var(--bb-primary)]/25 shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-[var(--bb-primary)]/30 hover:shadow-xl"
          >
            {data.ctaLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
