// -----------------------------------------------------------------------------
// @file: components/blocks/HowItWorksBlock.tsx
// @purpose: Public-facing "how it works" block. Renders 1 to 5 numbered
//           steps in a responsive grid (3 columns on sm+, 1 column on
//           mobile). The currently-shipped landing-page steps section
//           ("Submit a creative request" → "Get matched" → "Review &
//           revise") corresponds to the default 3-step shape.
//
//           The block keeps its own outer <section> so it can be placed
//           anywhere in a page-block sequence, and the spacing matches
//           the rest of the marketing layout.
// -----------------------------------------------------------------------------
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-04-28
// -----------------------------------------------------------------------------

import type { HowItWorksData } from "@/lib/blocks/types";

type HowItWorksBlockProps = {
  data: HowItWorksData;
};

export function HowItWorksBlock({ data }: HowItWorksBlockProps) {
  const steps = data.steps;
  // Tailwind grid columns key off step count so 4 steps render 2x2 on
  // sm and 4-up on lg, while 3 steps stay 3-up. Five-step layouts
  // collapse to wrap naturally.
  const gridCols =
    steps.length <= 2
      ? "sm:grid-cols-2"
      : steps.length === 3
        ? "sm:grid-cols-3"
        : steps.length === 4
          ? "sm:grid-cols-2 lg:grid-cols-4"
          : "sm:grid-cols-3 lg:grid-cols-5";

  return (
    <section id="how-it-works" className="relative bg-white px-6 pt-12 pb-20 sm:pb-28">
      {(data.eyebrow || data.title) && (
        <div className="mx-auto mb-10 max-w-3xl text-center">
          {data.eyebrow ? (
            <p className="text-xs font-semibold tracking-[0.16em] text-[var(--bb-primary)] uppercase">
              {data.eyebrow}
            </p>
          ) : null}
          {data.title ? (
            <h2 className="font-brand mt-3 text-3xl leading-tight font-bold tracking-tight text-[var(--bb-secondary)] sm:text-4xl">
              {data.title}
            </h2>
          ) : null}
        </div>
      )}

      <div className={`mx-auto grid max-w-5xl grid-cols-1 gap-12 ${gridCols} sm:gap-8`}>
        {steps.map((step, i) => (
          <div key={i} className="flex flex-col items-center text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bb-secondary)] text-xl font-bold text-white">
              {i + 1}
            </div>
            <h3 className="mb-2 text-base font-bold text-[var(--bb-secondary)]">{step.title}</h3>
            <p className="max-w-xs text-sm leading-relaxed text-[var(--bb-text-secondary)]">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
