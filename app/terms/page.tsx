// -----------------------------------------------------------------------------
// @file: app/terms/page.tsx
// @purpose: Terms page — 2026 redesign ("Terms & conditions.", Figma nodes
//           50:1400 desktop / 50:1610 mobile). Static content; replaces the
//           CmsPageView("terms") shim (whose CmsPage row was never authored,
//           so the old page rendered empty chrome).
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-07-26
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { HomeFooter } from "@/components/marketing/home-footer";
import { HomeHeader } from "@/components/marketing/home-header";
import { QuestionsBand } from "@/components/marketing/questions-band";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "Brandbite's terms of service. Clear terms. No fine print panic.",
};

const displayFont = "font-[family-name:var(--font-inter)]";

const RULES = [
  {
    icon: "/home/about-clarity.png",
    title: "Use Brandbite nicely",
    body: "Brandbite is built to help you create faster, sharper and with less chaos. Use the service for lawful, respectful and brand-safe creative requests.",
  },
  {
    icon: "/home/step-match.png",
    title: "Your final work is yours",
    body: "Once a project is delivered, the final approved assets belong to you. We may only showcase selected work in our portfolio unless you ask us not to.",
  },
  {
    icon: "/home/about-momentum.png",
    title: "Pause, cancel, no drama",
    body: "You can pause or cancel your plan anytime. No guilt trip, no dramatic goodbye scene. Your files, assets and completed work stay yours.",
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen w-full bg-[#F7F4F1]">
      <main
        id="main-content"
        className="mx-auto w-full max-w-[1140px] overflow-hidden bg-[#F7F4F1]"
      >
        <HomeHeader />

        {/* Hero */}
        <section className="relative mx-auto h-[751px] w-[993px] origin-top max-[1179px]:h-[620px] max-[1179px]:scale-80 max-[929px]:h-[520px] max-[929px]:scale-[0.66] max-[767px]:flex max-[767px]:h-auto max-[767px]:w-full max-[767px]:scale-100 max-[767px]:flex-col max-[767px]:items-center max-[767px]:px-5 max-[767px]:pt-5">
          <div className="absolute top-[80px] left-[-12.5px] h-[127px] w-[209px] max-[767px]:static max-[767px]:order-1">
            <Image
              src="/home/terms-doodle.png"
              alt=""
              width={209}
              height={127}
              className="h-[127px] w-[209px]"
            />
          </div>
          <div className="absolute top-[203px] left-[22px] flex w-[366px] flex-col gap-5 max-[767px]:static max-[767px]:order-2 max-[767px]:mt-5 max-[767px]:w-full max-[767px]:items-center">
            <h1
              className={`flex flex-col gap-1 ${displayFont} text-[64px] leading-[64px] font-extrabold max-[767px]:items-center max-[767px]:text-center max-[767px]:text-[54px] max-[767px]:leading-[56px]`}
            >
              <span className="text-[#2B2D33]">Terms &amp;</span>
              <span className="text-[#FF6426]">conditions.</span>
            </h1>
            <p className="text-base leading-6 text-[#2B2D33] max-[767px]:text-center">
              Clear terms. No fine print panic.
            </p>
            <div className="flex flex-row items-center justify-center gap-2.5 rounded-xl bg-white p-2.5">
              <Image src="/home/info-icon.png" alt="" width={60} height={60} className="shrink-0" />
              <p className="text-base leading-6 text-[#2B2D33]">
                By using Brandbite, you agree to the terms below. If something isn&rsquo;t clear,
                reach out.
              </p>
            </div>
            <Link
              href="/contact"
              className="flex flex-row items-center gap-[9px] transition-opacity hover:opacity-75"
            >
              <span className="text-xl leading-8 font-bold whitespace-nowrap text-[#2B2D33]">
                Reach out
              </span>
              <Image src="/home/arrow-chat.svg" alt="" width={24} height={24} />
            </Link>
          </div>
          {/* BB waving, leaning on the orange bitemark "b" */}
          <div className="absolute top-[87px] left-[470.5px] h-[640px] w-[536px] max-[767px]:static max-[767px]:order-3 max-[767px]:mt-8 max-[767px]:h-[399px] max-[767px]:w-full max-[767px]:max-w-[402px]">
            <div className="relative h-full w-full">
              <Image
                src="/home/about-b.svg"
                alt=""
                width={400}
                height={634}
                className="absolute top-[6px] left-[136px] h-[634px] w-[400px] max-[767px]:top-[3px] max-[767px]:left-[132px] max-[767px]:h-[380px] max-[767px]:w-[240px]"
              />
              <Image
                src="/home/about-bb.webp"
                alt="BB the unicorn presenting the terms"
                width={380}
                height={640}
                priority
                className="absolute top-0 left-0 h-[640px] w-[380px] object-cover max-[767px]:top-0 max-[767px]:left-[50px] max-[767px]:h-[383px] max-[767px]:w-[227px]"
              />
            </div>
          </div>
        </section>

        {/* Terms cards */}
        <section className="flex w-full flex-col items-stretch gap-5 bg-white p-10 max-[767px]:px-5">
          {RULES.map((rule) => (
            <div
              key={rule.title}
              className="flex w-full flex-row items-center gap-px rounded-xl bg-[#F7F4F1] px-5 max-[767px]:flex-col max-[767px]:items-start max-[767px]:gap-3 max-[767px]:p-5"
            >
              <Image src={rule.icon} alt="" width={100} height={100} className="shrink-0" />
              <div className="flex min-w-px flex-1 flex-col items-start justify-center gap-[5px] border-l border-[#D7D8DD] py-5 pl-5 max-[767px]:border-l-0 max-[767px]:py-0 max-[767px]:pl-0">
                <h2 className={`${displayFont} text-base leading-5 font-bold text-[#2B2D33]`}>
                  {rule.title}
                </h2>
                <p className="text-base leading-6 text-[#2B2D33]">{rule.body}</p>
              </div>
            </div>
          ))}
        </section>

        <QuestionsBand />
        <HomeFooter />
        <div className="h-5" />
      </main>
    </div>
  );
}
