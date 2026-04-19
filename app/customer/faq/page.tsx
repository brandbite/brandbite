// -----------------------------------------------------------------------------
// @file: app/customer/faq/page.tsx
// @purpose: Logged-in FAQ page for company members. Same content as the public
//           /faq, but rendered inside the customer dashboard chrome.
// -----------------------------------------------------------------------------

import { FaqBrowser } from "@/components/faq/faq-browser";

export default function CustomerFaqPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 md:px-0">
      <header className="mb-8">
        <p className="text-xs font-bold tracking-[0.2em] text-[var(--bb-primary)] uppercase">FAQ</p>
        <h1 className="font-brand mt-2 text-3xl font-bold tracking-tight text-[var(--bb-secondary)] sm:text-4xl">
          Frequently Asked Questions
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--bb-text-secondary)]">
          Everything you need to know about using Brandbite. Can&apos;t find what you&apos;re
          looking for? Contact your account manager or reach out via the consultation feature.
        </p>
      </header>

      <FaqBrowser />
    </div>
  );
}
