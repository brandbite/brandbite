// -----------------------------------------------------------------------------
// @file: app/about/page.tsx
// @purpose: About page — 2026 redesign ("A team with a big bite.", Figma
//           nodes 43:10 desktop / 45:27 mobile). Static content; replaces
//           the CmsPageView("about") shim, so the CmsPage row at
//           /admin/pages no longer drives this page.
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-07-26
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Image from "next/image";

import { HomeFooter } from "@/components/marketing/home-footer";
import { HomeHeader } from "@/components/marketing/home-header";
import { ReadyBand } from "@/components/marketing/ready-band";

export const metadata: Metadata = {
  title: "About",
  description:
    "Brandbite is a team of experienced creative problem solvers making high quality work easier to access. A team with a big bite.",
};

const displayFont = "font-[family-name:var(--font-inter)]";

const VALUES = [
  { icon: "/home/about-clarity.png", label: "Clarity", size: 110 },
  { icon: "/home/step-match.png", label: "Consistency", size: 100 },
  { icon: "/home/about-momentum.png", label: "Momentum", size: 100 },
];

const PARAGRAPHS = [
  "Brandbite grew out of years spent shaping brands, products and campaigns across industries, markets and time zones, from early-stage ideas to global projects. That experience taught us that great creative work takes more than talent. It takes the right people, clear thinking and a way of working that keeps good ideas moving.",
  "That’s why we brought together experienced creative problem solvers to make high quality work easier to access. No bloated teams, endless calls or lengthy freelancer searches. Just the right expertise for every request, a process that stays on track and creative work with enough bite to make an impact.",
];

export default function AboutPage() {
  return (
    <div className="min-h-screen w-full bg-[#F7F4F1]">
      <main
        id="main-content"
        className="mx-auto w-full max-w-[1140px] overflow-hidden bg-[#F7F4F1]"
      >
        <HomeHeader />

        {/* Hero */}
        <section className="relative mx-auto h-[751px] w-[993px] origin-top max-[1179px]:h-[620px] max-[1179px]:scale-80 max-[929px]:h-[520px] max-[929px]:scale-[0.66] max-[767px]:flex max-[767px]:h-auto max-[767px]:w-full max-[767px]:scale-100 max-[767px]:flex-col max-[767px]:items-center max-[767px]:px-5 max-[767px]:pt-5">
          <div className="absolute top-[70px] left-[-1px] h-[120px] w-[166px] max-[767px]:static max-[767px]:order-1 max-[767px]:self-start">
            <div className="h-[120px] w-[166px] bg-[url('/home/hero-badge.png')] bg-cover bg-center bg-no-repeat" />
          </div>
          <div className="absolute top-[203px] left-[22.5px] flex w-[436px] flex-col gap-5 max-[767px]:static max-[767px]:order-2 max-[767px]:mt-5 max-[767px]:w-full max-[767px]:items-center">
            {/* No fixed width here — Figma's 298px title box lets "with a big"
                overflow, but browsers wrap it, pushing the copy out of the
                hero. Let the headline take the full 436px copy column. */}
            <h1
              className={`flex flex-col gap-1 ${displayFont} text-[64px] font-extrabold max-[767px]:items-center max-[767px]:text-center max-[767px]:text-[54px]`}
            >
              <span className="leading-[64px] whitespace-pre-line text-[#2B2D33] max-[767px]:leading-[56px]">
                {"A team\nwith a big"}
              </span>
              <span className="leading-[64px] text-[#FF6426] max-[767px]:leading-[56px]">
                bite.
              </span>
            </h1>
            <div className="flex w-full flex-col gap-2.5 text-base leading-6 text-[#2B2D33] max-[767px]:text-center">
              {PARAGRAPHS.map((p) => (
                <p key={p.slice(0, 20)}>{p}</p>
              ))}
            </div>
          </div>
          {/* BB waving, leaning on the orange bitemark "b" */}
          <div className="absolute top-[24px] left-[488.5px] h-[640px] w-[504px] max-[767px]:static max-[767px]:order-3 max-[767px]:mt-8 max-[767px]:aspect-[402/417] max-[767px]:h-auto max-[767px]:w-full max-[767px]:max-w-[402px]">
            <div className="relative h-full w-full">
              <Image
                src="/home/about-b.svg"
                alt=""
                width={356}
                height={564}
                className="absolute top-[139px] left-[162px] h-[564px] w-[356px] max-[767px]:top-[25px] max-[767px]:left-[130px] max-[767px]:h-[377px] max-[767px]:w-[237px]"
              />
              <Image
                src="/home/about-bb.webp"
                alt="BB the unicorn waving hello"
                width={338}
                height={569}
                priority
                className="absolute top-[134px] left-[41px] h-[569px] w-[338px] object-cover max-[767px]:top-[22px] max-[767px]:left-[49px] max-[767px]:h-[379px] max-[767px]:w-[225px]"
              />
            </div>
          </div>
        </section>

        {/* What we care about */}
        <section className="flex h-[329px] w-full flex-row items-center justify-center gap-[116px] bg-white max-[929px]:h-auto max-[929px]:flex-wrap max-[929px]:gap-10 max-[929px]:px-6 max-[929px]:py-10 max-[767px]:flex-col max-[767px]:gap-5">
          <h2
            className={`w-[200px] shrink-0 ${displayFont} text-4xl leading-9 font-extrabold whitespace-pre-line text-[#2B2D33] max-[767px]:w-auto max-[767px]:pt-5 max-[767px]:text-center`}
          >
            {"What we\ncare about"}
          </h2>
          <div className="flex flex-row items-center justify-center gap-10 max-[767px]:flex-col">
            {VALUES.map((value, i) => (
              <div key={value.label} className="contents">
                {i > 0 && (
                  <div className="h-[120px] w-px bg-[#E0D2FF] max-[767px]:h-px max-[767px]:w-[120px]" />
                )}
                <div className="flex w-[140px] flex-col items-center justify-center gap-px">
                  <Image src={value.icon} alt="" width={value.size} height={value.size} />
                  <h3
                    className={`w-full ${displayFont} text-center text-base leading-5 font-bold text-[#2B2D33]`}
                  >
                    {value.label}
                  </h3>
                </div>
              </div>
            ))}
          </div>
        </section>

        <ReadyBand />
        <HomeFooter />
        <div className="h-5" />
      </main>
    </div>
  );
}
