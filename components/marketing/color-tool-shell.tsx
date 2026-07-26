// -----------------------------------------------------------------------------
// @file: components/marketing/color-tool-shell.tsx
// @purpose: Shared page chrome for the color tool subpages, in the design
//           language of the Figma "colors" hub frame (no per-tool frames
//           exist in Figma, so this extends the hub design): HomeHeader, a
//           compact hero (doodle + two-tone Inter ExtraBold title + blurb),
//           a white section wrapping the tool UI, a "more color tools"
//           card strip, the purple ReadyBand, and HomeFooter.
// -----------------------------------------------------------------------------

import Image from "next/image";

import { ColorToolCard } from "@/components/marketing/color-tool-card";
import { COLOR_TOOLS } from "@/components/marketing/color-tools";
import { HomeFooter } from "@/components/marketing/home-footer";
import { HomeHeader } from "@/components/marketing/home-header";
import { ReadyBand } from "@/components/marketing/ready-band";

const displayFont = "font-[family-name:var(--font-inter)]";

export function ColorToolShell({
  currentHref,
  title,
  accent,
  blurb,
  children,
}: {
  /** The tool's own href — excluded from the "more tools" strip. */
  currentHref: string;
  /** Dark part of the headline (may contain \n). */
  title: string;
  /** Orange part of the headline. */
  accent: string;
  blurb: string;
  children: React.ReactNode;
}) {
  const otherTools = COLOR_TOOLS.filter((tool) => tool.href !== currentHref);

  return (
    <div className="min-h-screen w-full bg-[#F7F4F1]">
      <main
        id="main-content"
        className="mx-auto w-full max-w-[1140px] overflow-hidden bg-[#F7F4F1]"
      >
        <HomeHeader />

        {/* Compact hero */}
        <section className="mx-auto flex w-[993px] max-w-full flex-col items-start gap-5 px-0 pt-[60px] pb-10 max-[1023px]:px-6 max-[767px]:items-center max-[767px]:px-5 max-[767px]:pt-8 max-[767px]:pb-6">
          <Image
            src="/home/colors-doodle.png"
            alt=""
            width={186}
            height={100}
            className="h-[100px] w-[186px]"
          />
          <h1
            className={`${displayFont} text-5xl leading-[52px] font-extrabold max-[767px]:text-center max-[767px]:text-4xl max-[767px]:leading-10`}
          >
            <span className="whitespace-pre-line text-[#2B2D33]">{title}</span>{" "}
            <span className="text-[#FF6426]">{accent}</span>
          </h1>
          <p className="text-base leading-6 text-[#2B2D33] max-[767px]:text-center">{blurb}</p>
        </section>

        {/* Tool */}
        <section className="w-full bg-white px-[60px] py-[60px] max-[1023px]:px-6 max-[767px]:px-4 max-[767px]:py-10">
          {children}
        </section>

        {/* More tools */}
        <section className="flex w-full flex-col items-center gap-10 py-[60px] max-[767px]:gap-5 max-[767px]:py-10">
          <h2
            className={`w-full px-[73px] ${displayFont} text-4xl leading-9 font-extrabold text-[#2B2D33] max-[1023px]:px-6 max-[767px]:px-[30px] max-[767px]:text-center`}
          >
            More Color Tools
          </h2>
          <div className="flex flex-row items-stretch justify-center gap-5 max-[1023px]:flex-wrap max-[767px]:flex-col max-[767px]:items-center">
            {otherTools.map((tool) => (
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
