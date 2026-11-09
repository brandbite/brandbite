// -----------------------------------------------------------------------------
// @file: app/meet/page.tsx
// @purpose: Public page for booking a free 30-minute call with Brandbite. Follows
//           the Color Studio visual rules: 1200px content, Inter headings, the same
//           colors and control sizes.
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Image from "next/image";
import type { ReactNode } from "react";

import { HomeFooter } from "@/components/marketing/home-footer";
import { HomeHeader } from "@/components/marketing/home-header";
import { MeetingBooking, VideoIcon } from "@/components/marketing/meeting-booking";
import { pageMetadata } from "@/lib/seo/metadata";

import "@/components/marketing/meet.css";

export const metadata: Metadata = pageMetadata({
  title: "Meet brandbite",
  description:
    "Book a free 30-minute video call to talk through your brand and see how brandbite can help.",
  path: "/meet",
});

const GUTTER = "px-14 max-[1179px]:px-8 max-[767px]:px-4";

const FAQS = [
  {
    question: "Is the call really free?",
    answer: "Yes. The intro call is free, and booking it doesn't commit you to anything.",
  },
  {
    question: "What if I need to reschedule?",
    answer: "Use the link in your confirmation email to pick a new time or cancel.",
  },
  {
    question: "Do I need a brief?",
    answer: "No. Just tell us about your brand and what you need. If you have a brief, bring it.",
  },
];

function FactIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

const FACTS = [
  {
    label: "30 minutes",
    icon: (
      <FactIcon>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </FactIcon>
    ),
  },
  { label: "Video call", icon: <VideoIcon /> },
  {
    label: "Free intro call",
    icon: (
      <FactIcon>
        <rect x="3" y="8" width="18" height="4" rx="1" />
        <path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8" />
        <path d="M12 8v13" />
        <path d="M12 8S10.5 3 8 3a2.5 2.5 0 0 0 0 5h4Zm0 0s1.5-5 4-5a2.5 2.5 0 0 1 0 5h-4Z" />
      </FactIcon>
    ),
  },
];

export default function MeetPage() {
  return (
    <div className="meet-page min-h-screen w-full">
      <main id="main-content" className="mx-auto w-full max-w-[1312px] overflow-hidden">
        <HomeHeader />

        <section
          className={`flex items-center justify-between gap-8 pt-10 pb-8 max-[767px]:pt-6 ${GUTTER}`}
        >
          <div className="min-w-0">
            <span className="inline-block rounded-full bg-[var(--meet-soft)] px-3 py-1 text-sm leading-5 font-semibold text-[var(--meet-soft-text)]">
              LET&apos;S TALK
            </span>
            <h1 className="mt-4 text-[48px] leading-[56px] font-bold max-[767px]:text-[32px] max-[767px]:leading-10">
              Meet <span className="text-[var(--meet-brand)]">brandbite.</span>
            </h1>
            <p className="mt-2 max-w-[560px] text-base leading-6 text-[var(--meet-muted)]">
              A free 30-minute video call with Olca to talk through your brand and how we can help.
            </p>
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm leading-5 font-medium">
              {FACTS.map((fact, index) => (
                <li
                  key={fact.label}
                  className={`flex items-center gap-2 ${
                    index > 0
                      ? "border-l border-[var(--meet-border)] pl-6 max-[479px]:border-l-0 max-[479px]:pl-0"
                      : ""
                  }`}
                >
                  {fact.icon}
                  {fact.label}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative h-[220px] w-[260px] shrink-0 max-[767px]:hidden">
            <svg
              aria-hidden="true"
              viewBox="0 0 40 40"
              className="absolute top-3 left-0 h-12 w-12 text-[#8D5BFF]"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            >
              <path d="M26 6l6 12" />
              <path d="M10 14l14 8" />
              <path d="M6 30l14-2" />
            </svg>
            <Image
              src="/home/unicorn-wave.webp"
              alt="BB the unicorn on a beanbag with a laptop"
              width={240}
              height={240}
              priority
              className="absolute right-0 bottom-0 h-[220px] w-[220px] object-contain"
            />
          </div>
        </section>

        <div className={GUTTER}>
          <section className="rounded-2xl border border-[var(--meet-border)] bg-[var(--meet-surface)] p-8 max-[767px]:p-5">
            <MeetingBooking />
          </section>

          <p className="mt-6 flex items-center gap-2 rounded-2xl bg-[var(--meet-soft)] px-4 py-3 text-sm leading-5">
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="shrink-0"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5" />
              <path d="M12 8h.01" />
            </svg>
            No preparation needed. Just bring your questions.
          </p>

          <div className="mt-6 grid grid-cols-3 items-start gap-4 max-[899px]:grid-cols-1">
            {FAQS.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-2xl border border-[var(--meet-border)] bg-[var(--meet-surface)]"
              >
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-sm leading-5 font-semibold [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  <span
                    aria-hidden="true"
                    className="text-xl leading-none font-normal transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="px-5 pb-4 text-sm leading-5 text-[var(--meet-muted)]">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <HomeFooter />
        </div>
        <div className="h-5" />
      </main>
    </div>
  );
}
