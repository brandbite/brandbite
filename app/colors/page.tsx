// -----------------------------------------------------------------------------
// @file: app/colors/page.tsx
// @purpose: Color Tools hub — 2026 redesign ("Colors that hit different.",
//           Figma nodes 46:198 desktop / 47:358 mobile). Static; the five
//           tool cards come from the shared COLOR_TOOLS catalog.
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-07-26
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Image from "next/image";

import { ColorToolCard } from "@/components/marketing/color-tool-card";
import { COLOR_TOOLS } from "@/components/marketing/color-tools";
import { HomeFooter } from "@/components/marketing/home-footer";
import { HomeHeader } from "@/components/marketing/home-header";
import { ReadyBand } from "@/components/marketing/ready-band";

export const metadata: Metadata = {
  title: "Color Tools",
  description: "Tools and palettes that keep your brand bold, consistent, and unmistakably yours.",
};

const displayFont = "font-[family-name:var(--font-inter)]";

export default function ColorsHubPage() {
  return (
    <div className="min-h-screen w-full bg-[#F7F4F1]">
      <main
        id="main-content"
        className="mx-auto w-full max-w-[1140px] overflow-hidden bg-[#F7F4F1]"
      >
        <HomeHeader />

        {/* Hero */}
        <section className="relative mx-auto h-[751px] w-[993px] origin-top max-[1179px]:h-[600px] max-[1179px]:scale-80 max-[929px]:h-[500px] max-[929px]:scale-[0.66] max-[767px]:flex max-[767px]:h-auto max-[767px]:w-full max-[767px]:scale-100 max-[767px]:flex-col max-[767px]:items-center max-[767px]:pt-5">
          <div className="absolute top-[104px] left-[-8.5px] h-[100px] w-[186px] max-[767px]:static max-[767px]:order-1">
            <Image
              src="/home/colors-doodle.png"
              alt=""
              width={186}
              height={100}
              className="h-[100px] w-[186px]"
            />
          </div>
          <div className="absolute top-[203px] left-[22px] flex w-[366px] flex-col gap-5 max-[767px]:static max-[767px]:order-2 max-[767px]:mt-5 max-[767px]:items-center">
            <h1
              className={`flex w-[298px] flex-col gap-1 ${displayFont} text-[64px] font-extrabold max-[767px]:items-center max-[767px]:text-center max-[767px]:text-[54px]`}
            >
              <span className="leading-[64px] whitespace-pre-line text-[#2B2D33] max-[767px]:leading-[56px]">
                {"Colors\nthat hit"}
              </span>
              <span className="leading-[64px] text-[#FF6426] max-[767px]:leading-[56px]">
                different.
              </span>
            </h1>
            <p className="text-base leading-6 whitespace-pre-line text-[#2B2D33] max-[767px]:text-center">
              {"Tools and palettes that keep your brand bold,\nconsistent, and unmistakably yours."}
            </p>
          </div>
          {/* BB with color swatch fans, leaning on the orange bitemark "b" */}
          <div className="absolute top-[24px] left-[488.5px] h-[640px] w-[504px] max-[767px]:static max-[767px]:order-3 max-[767px]:mt-8 max-[767px]:h-[447px] max-[767px]:w-full max-[767px]:max-w-[430px]">
            <div className="relative h-full w-full">
              <Image
                src="/home/contact-b.svg"
                alt=""
                width={400}
                height={634}
                className="absolute top-[69px] left-[118px] h-[634px] w-[400px] max-[767px]:top-[52px] max-[767px]:left-[157px] max-[767px]:h-[373px] max-[767px]:w-[236px]"
              />
              <div className="absolute top-[60px] left-[-174px] h-[640px] w-[712px] overflow-hidden max-[767px]:top-[47px] max-[767px]:left-[-15px] max-[767px]:h-[376px] max-[767px]:w-[419px]">
                <Image
                  src="/home/colors-bb.webp"
                  alt="BB the unicorn holding color swatch fans"
                  width={712}
                  height={712}
                  priority
                  className="absolute top-[-5.43%] left-0 h-[111.3%] w-full max-w-none object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Explore Color Tools */}
        <section className="flex w-full flex-col items-center justify-center gap-10 bg-white py-[60px] max-[767px]:gap-5 max-[767px]:py-10">
          <h2
            className={`w-full px-[60px] ${displayFont} text-4xl leading-9 font-extrabold text-[#2B2D33] max-[767px]:px-[30px] max-[767px]:pt-5 max-[767px]:text-center`}
          >
            Explore Color Tools
          </h2>
          <div className="flex flex-row items-stretch justify-center gap-5 max-[1023px]:flex-wrap max-[767px]:flex-col max-[767px]:items-center">
            {COLOR_TOOLS.map((tool) => (
              <ColorToolCard key={tool.href} tool={tool} />
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
