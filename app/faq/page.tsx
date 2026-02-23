// -----------------------------------------------------------------------------
// @file: app/faq/page.tsx
// @purpose: Dedicated FAQ page — categorised accordion with filtering
// -----------------------------------------------------------------------------

"use client";

import Link from "next/link";
import { useState } from "react";

import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

type Faq = { q: string; a: string; category: string };

const CATEGORIES = [
  "All",
  "General",
  "Pricing & Billing",
  "Creative Process",
  "Platform & Tools",
  "Agencies & Teams",
] as const;

const FAQS: Faq[] = [
  // ── General ──────────────────────────────────────────────────────────────
  {
    category: "General",
    q: "What is Brandbite?",
    a: "Brandbite is a creative-as-a-service platform that gives you access to unlimited design and creative requests for a flat monthly subscription. Think of it as having an entire creative team on demand \u2014 without the overhead of hiring in-house or managing freelancers.",
  },
  {
    category: "General",
    q: "Who is Brandbite for?",
    a: "Brandbite is built for startups, marketing teams, agencies, e-commerce brands, and anyone who needs a steady stream of high-quality creative work. Whether you\u2019re a solo founder or a growing team, we scale with you.",
  },
  {
    category: "General",
    q: "How is Brandbite different from hiring a designer or agency?",
    a: "Traditional agencies charge per project with long timelines and unpredictable costs. Freelancers can be unreliable. Brandbite offers a flat monthly rate, no contracts, unlimited requests, and fast turnaround \u2014 so you get consistent quality without the hassle.",
  },
  {
    category: "General",
    q: "What types of creative work can I request?",
    a: "Almost anything visual! Brand identity, social media graphics, web design, packaging, pitch decks, presentations, email templates, motion graphics, illustrations, ad creatives, and more. If you can brief it, we can design it.",
  },
  {
    category: "General",
    q: "Do I own the work you create?",
    a: "Yes, 100%. Every deliverable we create is yours to keep and use however you like \u2014 even if you cancel your subscription. Full ownership, no strings attached.",
  },

  // ── Pricing & Billing ────────────────────────────────────────────────────
  {
    category: "Pricing & Billing",
    q: "How much does Brandbite cost?",
    a: "Plans start at $495/month with our Starter tier. We also offer Brand ($995/mo) and Scale ($1,995/mo) plans for teams that need more capacity and faster turnaround. Annual billing saves you 20%.",
  },
  {
    category: "Pricing & Billing",
    q: "Can I cancel anytime?",
    a: "Yes. You can pause or cancel your subscription at any time \u2014 no long-term contracts, no cancellation fees. Your work and assets remain yours even after cancellation.",
  },
  {
    category: "Pricing & Billing",
    q: "Is there a free trial?",
    a: "We don\u2019t offer a traditional free trial, but you can start with any plan knowing you can pause or cancel anytime. There\u2019s zero risk \u2014 if you\u2019re not happy within the first week, we\u2019ll refund your subscription.",
  },
  {
    category: "Pricing & Billing",
    q: "What payment methods do you accept?",
    a: "We accept all major credit and debit cards (Visa, Mastercard, American Express) processed securely through Stripe. Invoicing is available for annual enterprise plans.",
  },
  {
    category: "Pricing & Billing",
    q: "What happens when I pause my subscription?",
    a: "When you pause, billing stops immediately. Any work in progress is saved and waiting for you when you come back. You can resume anytime and pick up right where you left off.",
  },

  // ── Creative Process ─────────────────────────────────────────────────────
  {
    category: "Creative Process",
    q: "How fast will I get my creatives?",
    a: "Most requests are completed within 24\u201348 hours. Larger projects like brand identity guides or motion videos may take 3\u20135 business days depending on complexity. Priority plans get even faster turnaround.",
  },
  {
    category: "Creative Process",
    q: "What if I don\u2019t like the creative?",
    a: "No worries! Every plan includes unlimited revisions. We\u2019ll keep iterating until you\u2019re 100% happy with the result. Your satisfaction is our top priority.",
  },
  {
    category: "Creative Process",
    q: "How do I submit a creative request?",
    a: "Through the Brandbite platform \u2014 just create a ticket with your brief, upload any references or brand assets, and we\u2019ll get started. It\u2019s as simple as filling out a short form.",
  },
  {
    category: "Creative Process",
    q: "Can I have multiple requests at once?",
    a: "It depends on your plan. Starter allows 1 active request at a time, Brand allows 2 simultaneously, and Scale gives you unlimited active requests. All plans include an unlimited request queue.",
  },
  {
    category: "Creative Process",
    q: "What file formats do you deliver?",
    a: "We deliver in whatever format you need \u2014 PNG, JPG, SVG, PDF, Figma files, After Effects projects, and more. Just let us know your preferred format when submitting your request.",
  },

  // ── Platform & Tools ─────────────────────────────────────────────────────
  {
    category: "Platform & Tools",
    q: "How does the Brandbite platform work?",
    a: "It\u2019s simple: submit a request through your dashboard, track its progress in real time, review the deliverables, provide feedback, and download your final files. Everything happens in one place.",
  },
  {
    category: "Platform & Tools",
    q: "Can I collaborate with my team?",
    a: "Absolutely. Multi-seat plans let your team share projects, brand assets, and feedback in one workspace. Everyone stays aligned without endless email threads.",
  },
  {
    category: "Platform & Tools",
    q: "Do you integrate with other tools?",
    a: "Yes! We offer Slack integration for real-time project updates and notifications. Our built-in brand asset library stores all your logos, fonts, and guidelines in one place for easy access.",
  },
  {
    category: "Platform & Tools",
    q: "Is my data secure?",
    a: "Security is a top priority. We use enterprise-grade encryption for all data in transit and at rest, and our files are stored on Cloudflare\u2019s global network. SOC 2 compliance is currently in progress.",
  },

  // ── Agencies & Teams ─────────────────────────────────────────────────────
  {
    category: "Agencies & Teams",
    q: "Do you work with agencies?",
    a: "Absolutely. Many agencies use Brandbite as their white-label creative arm. We offer agency-friendly plans with multi-seat access and dedicated account managers so you can scale client work effortlessly.",
  },
  {
    category: "Agencies & Teams",
    q: "Can I add team members?",
    a: "Yes. The Brand plan includes up to 5 seats, and the Scale plan offers unlimited seats. Additional seats can be added to any plan \u2014 just reach out to our team.",
  },
  {
    category: "Agencies & Teams",
    q: "Do you offer custom enterprise plans?",
    a: "Yes. For larger organisations with specific needs, we offer tailored enterprise plans with custom SLAs, dedicated designers, and priority support. Contact us at hello@brandbite.co to discuss.",
  },
];

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function FaqAccordion({ faqs }: { faqs: Faq[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {faqs.map((faq, i) => {
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FaqPage() {
  const [activeCategory, setActiveCategory] = useState<string>("All");

  const filtered =
    activeCategory === "All" ? FAQS : FAQS.filter((f) => f.category === activeCategory);

  return (
    <div className="flex min-h-screen flex-col bg-white text-[var(--bb-secondary)]">
      <SiteHeader activePage="FAQs" />

      {/* ----------------------------------------------------------------- */}
      {/* Hero                                                              */}
      {/* ----------------------------------------------------------------- */}
      <section className="relative overflow-hidden bg-white px-6 pt-14 pb-16 sm:pt-20 sm:pb-20">
        {/* Bitemark background */}
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

      {/* ----------------------------------------------------------------- */}
      {/* Category pills + accordion                                        */}
      {/* ----------------------------------------------------------------- */}
      <section className="mx-auto w-full max-w-3xl px-6 pb-20 sm:pb-24">
        {/* Category pills */}
        <div className="mb-10 flex flex-wrap justify-center gap-2">
          {CATEGORIES.map((cat) => (
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

        {/* Accordion */}
        <FaqAccordion faqs={filtered} />
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* CTA                                                               */}
      {/* ----------------------------------------------------------------- */}
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
