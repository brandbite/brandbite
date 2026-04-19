// -----------------------------------------------------------------------------
// @file: app/faq/page.tsx
// @purpose: Public FAQ marketing page. Shares FAQ content + accordion with the
//           logged-in dashboard FAQ pages via components/faq/faq-browser.tsx.
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";

import { FaqBrowser } from "@/components/faq/faq-browser";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export default function FaqPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-[var(--bb-secondary)]">
      <SiteHeader activePage="FAQs" />

      {/* --------------------------------------------------------------- */}
      {/* Hero                                                            */}
      {/* --------------------------------------------------------------- */}
      <section className="relative overflow-hidden bg-white px-6 pt-14 pb-16 sm:pt-20 sm:pb-20">
        {/* Bitemark background */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/bitemark.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 h-full w-auto max-w-none object-cover object-left-top select-none"
        />

        <div className="relative mx-auto max-w-6xl text-center">
          <p className="text-sm font-bold tracking-widest text-[var(--bb-primary)] uppercase">
            FAQs
          </p>
          <h1 className="font-brand mt-3 text-4xl font-bold tracking-tight text-[var(--bb-secondary)] sm:text-5xl">
            Frequently Asked Questions
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[var(--bb-text-secondary)]">
            Everything you need to know about Brandbite. Can&apos;t find what you&apos;re looking
            for? Reach out to our team.
          </p>
        </div>
      </section>

      {/* --------------------------------------------------------------- */}
      {/* Category pills + accordion                                      */}
      {/* --------------------------------------------------------------- */}
      <section className="mx-auto w-full max-w-3xl px-6 pb-20 sm:pb-24">
        <FaqBrowser />
      </section>

      {/* --------------------------------------------------------------- */}
      {/* CTA                                                             */}
      {/* --------------------------------------------------------------- */}
      <section className="bg-[var(--bb-bg-warm)] px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-brand text-2xl font-bold tracking-tight text-[var(--bb-secondary)] sm:text-3xl">
            Still have questions?
          </h2>
          <p className="mt-3 text-base text-[var(--bb-text-secondary)]">
            We&apos;re here to help. Get in touch and we&apos;ll get back to you as soon as
            possible.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/pricing"
              className="rounded-full bg-[var(--bb-primary)] px-8 py-3.5 text-sm font-bold tracking-wide text-white uppercase shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
            >
              View Pricing
            </Link>
            <Link
              href="/how-it-works"
              className="rounded-full border border-[var(--bb-border)] bg-white px-8 py-3.5 text-sm font-bold tracking-wide text-[var(--bb-secondary)] uppercase transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              How It Works
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
