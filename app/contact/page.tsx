// -----------------------------------------------------------------------------
// @file: app/contact/page.tsx
// @purpose: Public contact page — 2026 redesign ("Let's make something
//           awesome."). Static hero + client form posting to /api/contact.
//           Replaces the CmsPageView("contact") shim; the CmsPage row at
//           /admin/pages no longer drives this page.
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-07-26
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Image from "next/image";

import { ContactForm } from "@/components/marketing/contact-form";
import { HomeFooter } from "@/components/marketing/home-footer";
import { HomeHeader } from "@/components/marketing/home-header";

export const metadata: Metadata = {
  title: "Contact",
  description: "Have a project in mind? A question? Drop us a message. We'll get back to you ASAP.",
};

const displayFont = "font-[family-name:var(--font-inter)]";

export default function ContactPage() {
  return (
    <div className="min-h-screen w-full bg-[#F7F4F1]">
      <main
        id="main-content"
        className="mx-auto w-full max-w-[1140px] overflow-hidden bg-[#F7F4F1]"
      >
        <HomeHeader />

        {/* Hero */}
        <section className="relative mx-auto h-[751px] w-[993px] origin-top max-[1179px]:h-[600px] max-[1179px]:scale-80 max-[929px]:h-[500px] max-[929px]:scale-[0.66] max-[767px]:flex max-[767px]:h-auto max-[767px]:w-full max-[767px]:scale-100 max-[767px]:flex-col max-[767px]:items-center max-[767px]:pt-5">
          <div className="absolute top-[138px] left-[27.5px] h-[75px] w-[161px] max-[767px]:static max-[767px]:order-1">
            <Image
              src="/home/contact-doodle.png"
              alt=""
              width={161}
              height={75}
              className="h-[75px] w-[161px]"
            />
          </div>
          <div className="absolute top-[203px] left-[22px] flex w-[366px] flex-col gap-5 max-[767px]:static max-[767px]:order-2 max-[767px]:mt-5 max-[767px]:items-center">
            <h1
              className={`flex w-[336px] flex-col gap-1 ${displayFont} text-[64px] font-extrabold max-[767px]:items-center max-[767px]:text-center max-[767px]:text-[54px]`}
            >
              <span className="leading-[64px] whitespace-pre-line text-[#2B2D33] max-[767px]:leading-[56px]">
                {"Let’s make\nsomething"}
              </span>
              <span className="leading-[64px] text-[#FF6426] max-[767px]:leading-[56px]">
                awesome.
              </span>
            </h1>
            <p className="text-base leading-6 whitespace-pre-line text-[#2B2D33] max-[767px]:text-center">
              {
                "Have a project in mind? A question?\nDrop us a message. We’ll get back\nto you ASAP."
              }
            </p>
          </div>
          {/* BB on the phone, leaning on the orange bitemark "b" */}
          <div className="absolute top-[93px] left-[313.5px] h-[625px] w-[713px] max-[767px]:static max-[767px]:order-3 max-[767px]:mt-8 max-[767px]:h-[379px] max-[767px]:w-full max-[767px]:max-w-[380px]">
            <div className="relative h-full w-full">
              <Image
                src="/home/contact-b.svg"
                alt=""
                width={400}
                height={634}
                className="absolute top-[-31px] left-[258px] h-[634px] w-[400px] max-[767px]:top-0 max-[767px]:left-[147px] max-[767px]:h-[349px] max-[767px]:w-[219px]"
              />
              <Image
                src="/home/contact-bb.webp"
                alt="BB the unicorn taking your call"
                width={571}
                height={640}
                priority
                className="absolute top-[-7px] left-[-9px] h-[640px] w-[571px] object-cover max-[767px]:top-[13px] max-[767px]:left-0 max-[767px]:h-[352px] max-[767px]:w-[314px]"
              />
            </div>
          </div>
        </section>

        {/* Form */}
        <section className="flex w-full flex-col items-center gap-5 bg-white p-[60px] max-[767px]:gap-10 max-[767px]:px-5 max-[767px]:py-10">
          <ContactForm />
        </section>

        <HomeFooter />
        <div className="h-5" />
      </main>
    </div>
  );
}
