// -----------------------------------------------------------------------------
// @file: components/tools/tool-page.tsx
// @purpose: The parts every free tool's page is built from, around the tool
//           itself: the green note under the headline, a numbered step
//           heading, the three-step strip and the FAQs. No state, so both the
//           page and the tool can use them.
// -----------------------------------------------------------------------------

import type { ReactNode } from "react";

/** The green band under the headline: one promise, and a line that explains it. */
export function ToolNote({ title, text }: { title: string; text?: string }) {
  return (
    <p className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl bg-[#E3F1E4] px-5 py-3 text-[#14532D]">
      <span className="flex items-center gap-3 text-base leading-6 font-semibold">
        <svg
          aria-hidden
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0"
        >
          <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6zM8.5 12l2.5 2.5 4.5-5" />
        </svg>
        {title}
      </span>
      {text ? <span className="text-sm leading-5">{text}</span> : null}
    </p>
  );
}

/** "01 Add your images": the heading of one step of a tool. */
export function StepHeading({
  number,
  title,
  hint,
  id,
}: {
  number: number;
  title: string;
  hint?: string;
  id?: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--cs-brand)] text-sm leading-5 font-bold text-white"
      >
        {String(number).padStart(2, "0")}
      </span>
      <div className="min-w-0">
        <h2 id={id} className="text-2xl leading-9 font-bold">
          <span className="sr-only">Step {number}: </span>
          {title}
        </h2>
        {hint ? <p className="text-sm leading-5 text-[var(--cs-muted)]">{hint}</p> : null}
      </div>
    </div>
  );
}

export type ToolStep = {
  title: string;
  text: string;
  /** An SVG path on a 24 × 24 grid, drawn as a line. */
  icon: string;
};

/** The three steps of a tool in one row, as a summary under it. */
export function ToolSteps({ steps, labelId }: { steps: ToolStep[]; labelId: string }) {
  return (
    <section aria-labelledby={labelId} className="py-4">
      <h2 id={labelId} className="sr-only">
        How it works
      </h2>
      <ol className="grid grid-cols-3 max-[1023px]:grid-cols-1 max-[1023px]:gap-5">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className={`flex items-start gap-4 ${
              index > 0
                ? "min-[1024px]:border-l min-[1024px]:border-[var(--cs-border)] min-[1024px]:pl-8"
                : ""
            }`}
          >
            <span
              aria-hidden
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FFE9DF] text-[#C2410C]"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={step.icon} />
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block text-base leading-6 font-semibold">{step.title}</span>
              <span className="block text-sm leading-5 text-[var(--cs-muted)]">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export type ToolFaqItem = { question: string; answer: ReactNode };

/** Questions that open and close. Every answer is in the page's HTML. */
export function ToolFaq({ items, labelId }: { items: ToolFaqItem[]; labelId: string }) {
  return (
    <section aria-labelledby={labelId}>
      <h2 id={labelId} className="text-[28px] leading-9 font-bold">
        FAQs
      </h2>
      <div className="mt-4 flex flex-col gap-2">
        {items.map((item) => (
          <details
            key={item.question}
            className="group rounded-xl border border-[var(--cs-border)] bg-[var(--cs-surface)]"
          >
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 text-base leading-6 font-semibold [&::-webkit-details-marker]:hidden">
              {item.question}
              <svg
                aria-hidden
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 transition-transform group-open:rotate-180"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <div className="max-w-[820px] px-5 pb-4 text-base leading-6 text-[var(--cs-muted)]">
              {item.answer}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
