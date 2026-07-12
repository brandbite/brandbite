// -----------------------------------------------------------------------------
// @file: app/coming-soon/page.tsx
// @purpose: "Coming soon" placeholder for pages still being redesigned
//           (Pricing, Showcase, FAQs, Blog, socials). From the Claude Design
//           handoff bundled with the 2026 homepage redesign.
// @version: v1.0.0
// @status: active
// @lastUpdate: 2026-07-12
// -----------------------------------------------------------------------------

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { HomeFooter } from "@/components/marketing/home-footer";
import { HomeHeader } from "@/components/marketing/home-header";

export const metadata: Metadata = {
  title: "Coming Soon",
  description:
    "Brandbite is putting the final bite on something bold, playful, and seriously good.",
};

const displayFont = "font-[family-name:var(--font-inter)]";
const caveat = "font-[family-name:var(--font-caveat)]";

const CARDS = [
  {
    icon: "/home/why-flow.png",
    title: "Creative engine warming up",
    body: "Our ideas are revving. The best kind of chaos is in motion.",
    bar: "#8D5BFF",
  },
  {
    icon: "/home/step-revise.png",
    title: "Fresh pixels loading",
    body: "Designers are sweating the details (in a good way). Every pixel counts.",
    bar: "#FF6426",
  },
  {
    icon: "/home/step-match.png",
    title: "BB approved, almost",
    body: "We don't ship 'good enough'. BB is picky. So everything gets the extra love.",
    bar: "#8D5BFF",
  },
];

export default function ComingSoonPage() {
  return (
    <div className="min-h-screen w-full bg-[#F7F4F1]">
      <main
        id="main-content"
        className="mx-auto w-full max-w-[1140px] overflow-hidden bg-[#F7F4F1]"
      >
        <HomeHeader />

        {/* Hero */}
        <section className="flex flex-row items-start justify-between gap-[60px] px-[73px] pt-[72px] max-[979px]:flex-col max-[979px]:gap-10 max-[979px]:px-8 max-[979px]:pt-14 max-[767px]:px-5 max-[767px]:pt-10">
          <div className="flex max-w-[470px] flex-col items-start">
            <div className="mb-7 flex flex-col gap-0.5">
              <span className={`${caveat} text-[26px] font-bold text-[#8D5BFF]`}>✳</span>
              <span
                className={`block w-[200px] origin-left -rotate-6 ${caveat} text-2xl leading-[26px] text-[#2B2D33]`}
              >
                We&rsquo;re cooking
                <br />
                something epic.
              </span>
            </div>
            <h1
              className={`mb-6 ${displayFont} text-[64px] leading-[66px] font-extrabold text-[#2B2D33] max-[767px]:text-[44px] max-[767px]:leading-[48px]`}
            >
              Something worth the wait <span className="text-[#FF6426]">is coming.</span>{" "}
              <span className="align-super text-[32px] text-[#8D5BFF]">✳</span>
            </h1>
            <p className="mb-5 max-w-[340px] text-base leading-[26px] text-[#5E616E]">
              BB is putting the final bite on something bold, playful, and seriously good.
            </p>
            <p className="mb-9 text-base leading-[26px] text-[#5E616E]">
              No half-baked launches. <strong className="text-[#2B2D33]">Only full-flavor.</strong>
            </p>
            <div className="flex flex-row items-center gap-5 max-[767px]:flex-col max-[767px]:items-start max-[767px]:gap-4">
              <Link
                href="/"
                className="font-brand flex h-11 flex-row items-center justify-center gap-3 rounded-[10px] bg-[#1F2024] px-[22px] py-2.5 text-lg font-bold whitespace-nowrap text-white transition-colors hover:bg-[#FF6426]"
              >
                Back to home
                <Image src="/home/arrow-white.svg" alt="" width={20} height={15.7} />
              </Link>
              <a
                href="mailto:hello@brandbite.studio"
                className="font-brand flex h-11 items-center gap-2 rounded-[10px] border border-[#D7D8DD] bg-white px-[22px] py-2.5 text-lg font-bold whitespace-nowrap text-[#1F2024] transition-colors hover:border-[#FF6426] hover:text-[#FF6426]"
              >
                Say hi 👋
              </a>
            </div>
          </div>
          <div className="relative h-[560px] w-[400px] shrink-0 max-[979px]:self-center max-[767px]:-mb-28 max-[767px]:w-80 max-[767px]:origin-top-left max-[767px]:scale-80">
            <Image
              src="/home/under-construction.webp"
              alt="BB the unicorn building the Brandbite b"
              width={460}
              height={560}
              className="absolute top-0 left-[-30px] w-[460px]"
            />
            <div className="absolute top-[-10px] right-[-20px] w-[170px] rotate-4 bg-[#FAECDF] px-[18px] pt-[26px] pb-5 shadow-[0_8px_20px_rgba(31,32,36,0.12)] max-[767px]:right-[-20px]">
              <div className="absolute top-[-10px] left-[55px] h-[18px] w-14 -rotate-3 bg-[#B696FF] opacity-85" />
              <span className={`${caveat} text-[28px] leading-[30px] font-bold text-[#2B2D33]`}>
                Almost baked. ♡
              </span>
            </div>
            <span
              className={`absolute bottom-1 left-5 -rotate-5 ${caveat} text-[26px] leading-7 font-bold whitespace-nowrap text-[#2B2D33]`}
            >
              Polishing <span className="border-b-[3px] border-[#8D5BFF]">pixels.</span>
            </span>
          </div>
        </section>

        {/* Behind the scenes */}
        <section className="flex flex-col items-center px-6 pt-[90px]">
          <h2 className={`${caveat} text-center text-[28px] font-bold text-[#2B2D33]`}>
            Here&rsquo;s what&rsquo;s{" "}
            <span className="border-b-[3px] border-[#8D5BFF]">happening</span> behind the scenes:
          </h2>
          <div className="mt-12 flex flex-row justify-center gap-6 max-[979px]:flex-wrap">
            {CARDS.map((card) => (
              <div
                key={card.title}
                className="flex min-h-[200px] w-[300px] flex-col items-start rounded-2xl bg-white px-[26px] pt-7 pb-[26px] shadow-[0_6px_18px_rgba(31,32,36,0.05)]"
              >
                <div className="flex flex-row items-center gap-3.5">
                  <Image src={card.icon} alt="" width={56} height={56} className="shrink-0" />
                  <h3
                    className={`${displayFont} text-base leading-[21px] font-bold text-[#2B2D33]`}
                  >
                    {card.title}
                  </h3>
                </div>
                <p className="mt-3.5 text-sm leading-[22px] text-[#5E616E]">{card.body}</p>
                <div className="mt-auto w-full pt-[18px]">
                  <div className="h-1 w-[62%] rounded-sm" style={{ backgroundColor: card.bar }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Almost ready */}
        <section className="flex flex-row items-center justify-between gap-[60px] px-[100px] pt-[110px] max-[767px]:flex-col max-[767px]:gap-10 max-[767px]:px-5 max-[767px]:pt-[72px]">
          <div className="max-w-[480px]">
            <h2
              className={`mb-[22px] ${displayFont} text-[40px] leading-[44px] font-extrabold text-[#2B2D33] max-[767px]:text-[30px] max-[767px]:leading-[34px]`}
            >
              Creative work,
              <br />
              <span className="text-[#FF6426]">almost ready to bite.</span>
            </h2>
            <div className="flex flex-row items-start gap-4">
              <span className={`${caveat} text-[30px] leading-[30px] text-[#8D5BFF]`}>♡</span>
              <p className="max-w-[330px] text-base leading-[26px] text-[#5E616E]">
                Thanks for your patience. Great things take just a little more time (and a lot more
                heart).
              </p>
            </div>
          </div>
          <div className="relative w-[230px] shrink-0">
            <div className="relative w-[210px] -rotate-4 bg-[#FAECDF] px-5 pt-[30px] pb-6 shadow-[0_8px_20px_rgba(31,32,36,0.12)]">
              <div className="absolute top-[-10px] left-[72px] h-[18px] w-14 rotate-2 bg-[#B696FF] opacity-85" />
              <span className={`${caveat} text-[28px] leading-[30px] font-bold text-[#2B2D33]`}>
                Great taste doesn&rsquo;t rush.
              </span>
            </div>
            <span
              className={`absolute right-[-14px] bottom-[-30px] ${caveat} text-[30px] text-[#8D5BFF]`}
            >
              ✧
            </span>
          </div>
        </section>

        {/* Purple wave band */}
        <section className="relative mt-[90px]">
          <div className="absolute top-10 right-[-10%] bottom-0 left-[-10%] rounded-t-[50%_90px] bg-[#B696FF]" />
          <div className="relative flex min-h-[260px] items-end justify-center">
            <span
              className={`absolute bottom-[60px] left-[12%] -rotate-4 ${caveat} text-[26px] leading-7 font-bold text-[#2B2D33] max-[767px]:top-[66px] max-[767px]:bottom-auto max-[767px]:left-3.5`}
            >
              We&rsquo;ll be back
              <br />
              very soon!
            </span>
            <Image
              src="/home/paper-plane.png"
              alt=""
              width={170}
              height={170}
              className="absolute bottom-[110px] left-[30%] w-[170px]"
            />
            <div className="h-[260px] w-80 bg-[url('/home/unicorn-wave.webp')] [background-size:119.857%_135.761%] [background-position:50%_18.552%] bg-no-repeat" />
          </div>
        </section>

        <HomeFooter variant="coming-soon" />
      </main>
    </div>
  );
}
