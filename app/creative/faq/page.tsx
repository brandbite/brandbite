// -----------------------------------------------------------------------------
// @file: app/creative/faq/page.tsx
// @purpose: Logged-in FAQ page for creatives. Filtered to the categories most
//           relevant to creative workflow (hides customer-focused pricing /
//           agency topics that don't apply to contributors).
// -----------------------------------------------------------------------------

import { FaqBrowser } from "@/components/faq/faq-browser";

// Creatives care about the product basics and how the creative process works,
// but billing and agency plans are customer-facing concerns.
const CREATIVE_CATEGORIES = ["All", "General", "Creative Process", "Platform & Tools"] as const;

export default function CreativeFaqPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 md:px-0">
      <header className="mb-8">
        <p className="text-xs font-bold tracking-[0.2em] text-[var(--bb-primary)] uppercase">FAQ</p>
        <h1 className="font-brand mt-2 text-3xl font-bold tracking-tight text-[var(--bb-secondary)] sm:text-4xl">
          Frequently Asked Questions
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--bb-text-secondary)]">
          How Brandbite works from the creative side — requests, delivery, file formats, and
          platform tools.
        </p>
      </header>

      <FaqBrowser categories={CREATIVE_CATEGORIES} />
    </div>
  );
}
