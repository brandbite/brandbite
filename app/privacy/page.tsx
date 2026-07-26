// -----------------------------------------------------------------------------
// @file: app/privacy/page.tsx
// @purpose: Privacy page — 2026 redesign ("Privacy, kept clear and simple.",
//           Figma nodes 50:1760 desktop / 51:1858 mobile). Static content;
//           replaces the CmsPageView("privacy") shim (whose CmsPage row was
//           never authored, so the old page rendered empty chrome).
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-07-26
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Image from "next/image";

import { HomeFooter } from "@/components/marketing/home-footer";
import { HomeHeader } from "@/components/marketing/home-header";
import { QuestionsBand } from "@/components/marketing/questions-band";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Brandbite collects, uses, and protects your information. Privacy, kept clear and simple.",
};

const displayFont = "font-[family-name:var(--font-inter)]";

const RULES = [
  {
    icon: "/home/about-clarity.png",
    title: "We collect only what we need",
    body: "We only collect the information needed to run Brandbite properly, deliver your requests and keep your experience smooth. No unnecessary data hoarding, no creepy stuff.",
  },
  {
    icon: "/home/step-match.png",
    title: "Your data stays protected",
    body: "We use standard security practices to keep your information, briefs, files and account details safe. Your work stays yours, and your data is never sold.",
  },
  {
    icon: "/home/about-momentum.png",
    title: "You stay in control",
    body: "You can request access, updates or deletion of your information anytime. Clear rights, simple process, zero tiny-print drama.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen w-full bg-[#F7F4F1]">
      <main
        id="main-content"
        className="mx-auto w-full max-w-[1140px] overflow-hidden bg-[#F7F4F1]"
      >
        <HomeHeader />

        {/* Hero */}
        <section className="relative mx-auto h-[751px] w-[993px] origin-top max-[1179px]:h-[620px] max-[1179px]:scale-80 max-[929px]:h-[520px] max-[929px]:scale-[0.66] max-[767px]:flex max-[767px]:h-auto max-[767px]:w-full max-[767px]:scale-100 max-[767px]:flex-col max-[767px]:items-center max-[767px]:px-5 max-[767px]:pt-5">
          <div className="absolute top-[76px] left-[10.5px] h-[132px] w-[187px] max-[767px]:static max-[767px]:order-1">
            <Image
              src="/home/privacy-doodle.png"
              alt=""
              width={187}
              height={132}
              className="h-[132px] w-[187px]"
            />
          </div>
          <div className="absolute top-[203px] left-[22px] flex w-[366px] flex-col gap-5 max-[767px]:static max-[767px]:order-2 max-[767px]:mt-5 max-[767px]:w-full max-[767px]:items-center">
            <h1
              className={`flex flex-col gap-1 ${displayFont} text-[64px] leading-[64px] font-extrabold max-[767px]:items-center max-[767px]:text-center max-[767px]:text-[54px] max-[767px]:leading-[56px]`}
            >
              <span className="text-[#FF6426]">Privacy,</span>
              <span className="whitespace-pre-line text-[#2B2D33]">
                {"kept clear\nand simple."}
              </span>
            </h1>
            <p className="text-base leading-6 whitespace-pre-line text-[#2B2D33] max-[767px]:text-center max-[767px]:whitespace-normal">
              {
                "We respect your data like we respect your time.\nHere’s the simple version of how we collect,\nuse, and protect your information."
              }
            </p>
          </div>
          {/* BB holding a padlock shield, leaning on the orange bitemark "b" */}
          <div className="absolute top-[54px] left-[341.5px] h-[718px] w-[665px] max-[767px]:static max-[767px]:order-3 max-[767px]:mt-8 max-[767px]:h-[379px] max-[767px]:w-full max-[767px]:max-w-[352px]">
            <div className="relative h-full w-full">
              <Image
                src="/home/about-b.svg"
                alt=""
                width={400}
                height={634}
                className="absolute top-[39px] left-[265px] h-[634px] w-[400px] max-[767px]:top-[21px] max-[767px]:left-[127px] max-[767px]:h-[334px] max-[767px]:w-[212px]"
              />
              <Image
                src="/home/privacy-bb.webp"
                alt="BB the unicorn holding a padlock shield"
                width={571}
                height={718}
                priority
                className="absolute top-0 left-0 h-[718px] w-[571px] object-cover max-[767px]:top-0 max-[767px]:left-[-13px] max-[767px]:h-[379px] max-[767px]:w-[302px]"
              />
            </div>
          </div>
        </section>

        {/* Privacy cards */}
        <section className="flex w-full flex-col items-stretch gap-5 bg-white p-10 max-[767px]:px-5">
          {RULES.map((rule) => (
            <div
              key={rule.title}
              className="flex w-full flex-row items-center gap-px rounded-xl bg-[#F7F4F1] px-5 max-[767px]:p-5"
            >
              <Image src={rule.icon} alt="" width={100} height={100} className="shrink-0" />
              <div className="flex min-w-px flex-1 flex-col items-start justify-center gap-[5px] border-l border-[#D7D8DD] py-5 pl-5">
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
