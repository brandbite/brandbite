// -----------------------------------------------------------------------------
// @file: app/faq/page.tsx
// @purpose: Public FAQ page — 2026 redesign ("FAQs, but make them easy.").
//           Server component: questions come from the central Faq table
//           (edited at /admin/faq), rendered into the Figma design. The
//           portal FAQ surfaces (/customer/faq, /creative/faq) still use
//           FaqBrowser and are unaffected.
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-07-13
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Image from "next/image";

import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { HomeFooter } from "@/components/marketing/home-footer";
import { HomeHeader } from "@/components/marketing/home-header";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Everything you need to know about Brandbite. No jargon, no tiny-print drama.",
};

// Render per-request: the FAQ list comes from the database, which isn't
// reachable during CI's static prerender pass. Runtime SSR also means
// /admin/faq edits show up immediately (bustFaqCaches keeps /api/faq in
// sync for the portal surfaces).
export const dynamic = "force-dynamic";

const displayFont = "font-[family-name:var(--font-inter)]";

export default async function FaqPage() {
  // Same query as /api/faq: active rows, grouped by category then manual
  // position — the order admins arrange at /admin/faq.
  const faqs = await prisma.faq.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { position: "asc" }],
    select: { id: true, question: true, answer: true },
  });

  return (
    <div className="min-h-screen w-full bg-[#F7F4F1]">
      <main
        id="main-content"
        className="mx-auto w-full max-w-[1140px] overflow-hidden bg-[#F7F4F1]"
      >
        <HomeHeader />

        {/* Hero */}
        <section className="relative mx-auto h-[751px] w-[993px] origin-top max-[1179px]:h-[600px] max-[1179px]:scale-80 max-[929px]:h-[500px] max-[929px]:scale-[0.66] max-[767px]:flex max-[767px]:h-auto max-[767px]:w-full max-[767px]:scale-100 max-[767px]:flex-col max-[767px]:items-center max-[767px]:pt-5">
          <div className="absolute top-[91px] left-[-10.5px] h-[100px] w-[172px] max-[767px]:static max-[767px]:order-1">
            <Image
              src="/home/faq-doodle.png"
              alt=""
              width={172}
              height={100}
              className="h-[100px] w-[172px]"
            />
          </div>
          <div className="absolute top-[203px] left-[22px] flex w-[366px] flex-col gap-5 max-[767px]:static max-[767px]:order-2 max-[767px]:mt-5 max-[767px]:items-center">
            <h1
              className={`flex w-[298px] flex-col gap-1 ${displayFont} text-[64px] font-extrabold max-[767px]:items-center max-[767px]:text-center max-[767px]:text-[54px]`}
            >
              <span className="leading-[64px] whitespace-pre-line text-[#2B2D33] max-[767px]:leading-[56px]">
                {"FAQs, but\nmake them"}
              </span>
              <span className="leading-[64px] text-[#FF6426] max-[767px]:leading-[56px]">
                easy.
              </span>
            </h1>
            <p className="text-base leading-6 whitespace-pre-line text-[#2B2D33] max-[767px]:text-center">
              {"Everything you need to know\nabout Brandbite.\n\nNo jargon, no tiny-print drama."}
            </p>
          </div>
          <div className="absolute top-[93px] left-[313.5px] h-[625px] w-[713px] max-[767px]:static max-[767px]:order-3 max-[767px]:mt-10 max-[767px]:h-auto max-[767px]:w-full max-[767px]:max-w-[402px]">
            <Image
              src="/home/faq-hero.webp"
              alt="BB the unicorn answering FAQs at a laptop"
              width={713}
              height={625}
              priority
              className="h-full w-full object-cover max-[767px]:h-auto"
            />
          </div>
        </section>

        {/* FAQ list */}
        <section className="flex w-full flex-col items-center justify-center bg-white py-[60px]">
          <FaqAccordion faqs={faqs} />
        </section>

        {/* Still have questions */}
        <section className="relative flex h-[309px] w-full flex-row items-center justify-between bg-[#B696FF] px-[70px] max-[1023px]:px-8 max-[767px]:h-auto max-[767px]:flex-col max-[767px]:items-center max-[767px]:gap-10 max-[767px]:px-5 max-[767px]:pt-10">
          <div className="flex w-[400px] flex-col items-start gap-6 max-[767px]:w-full max-[767px]:max-w-[400px]">
            <h2
              className={`flex w-full flex-col gap-[5px] ${displayFont} text-4xl leading-9 font-extrabold`}
            >
              <span className="text-[#2B2D33]">Still have</span>
              <span className="text-white">questions?</span>
            </h2>
            <p className="w-full text-sm leading-5 text-[#2B2D33]">
              We&rsquo;re here to help. If you need more clarity, our team is always just a message
              away.
            </p>
            <a
              href="mailto:hello@brandbite.studio"
              className="flex flex-row items-center gap-[9px] transition-opacity hover:opacity-85"
            >
              <span className="text-xl leading-8 font-bold whitespace-nowrap text-white">
                Chat with the team
              </span>
              <Image src="/home/arrow-chat.svg" alt="" width={24} height={24} />
            </a>
          </div>
          <Image
            src="/home/paper-plane.png"
            alt=""
            width={235}
            height={80}
            className="absolute top-[204px] left-[297px] h-20 w-[235px] object-cover max-[1023px]:hidden"
          />
          <div className="relative h-[309px] w-[350px] shrink-0 max-[767px]:order-3">
            <div className="h-full w-full bg-[url('/home/unicorn-wave.webp')] [background-size:119.857%_135.761%] [background-position:50%_18.552%] bg-no-repeat" />
          </div>
          <Image
            src="/home/faq-note.webp"
            alt="Sticky note: We like clarity. You'll like the experience."
            width={210}
            height={140}
            className="h-[140px] w-[210px] shrink-0 object-cover max-[1023px]:hidden max-[767px]:static max-[767px]:order-2 max-[767px]:block"
          />
        </section>

        <HomeFooter />
        <div className="h-5" />
      </main>
    </div>
  );
}
