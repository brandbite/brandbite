// -----------------------------------------------------------------------------
// @file: app/page.tsx
// @purpose: Marketing homepage — 2026 redesign from the Claude Design handoff
//           ("Creative that hits different"). Static content; sections still
//           being redesigned link to /coming-soon.
// @version: v2.0.0
// @status: active
// @lastUpdate: 2026-07-12
// -----------------------------------------------------------------------------

import Image from "next/image";
import Link from "next/link";

import { HomeFooter } from "@/components/marketing/home-footer";
import { HomeHeader } from "@/components/marketing/home-header";

// Inter, not the global Josefin heading font — the design sets all display
// type in Inter ExtraBold.
const displayFont = "font-[family-name:var(--font-inter)]";

const STEPS = [
  {
    icon: "/home/step-brief.png",
    title: "Drop the brief",
    body: "Tell us what you need. The more details, the better.",
    width: "w-[148px]",
  },
  {
    icon: "/home/step-match.png",
    title: "Get matched",
    body: "We match you with the right creative who starts working within 24 hours.",
    width: "w-[149px]",
  },
  {
    icon: "/home/step-revise.png",
    title: "Revise until it hits",
    body: "Ask for changes until it feels right. No drama, no endless chase.",
    width: "w-[155px]",
  },
];

const WORKS = ["/home/work-1.png", "/home/work-2.png", "/home/work-3.png", "/home/work-4.png"];

const WHY_ITEMS = [
  {
    icon: "/home/why-turnaround.png",
    title: "1-2 day turnaround",
    body: "Creative requests move fast, so your campaigns don’t wait around.",
  },
  {
    icon: "/home/why-flow.png",
    title: "Creative flow, minus the chaos",
    body: "Even when requests pile up, your workflow stays smooth.",
  },
  {
    icon: "/home/why-pause.png",
    title: "Pause anytime",
    body: "Need a break? Pause your plan without making it weird.",
  },
  {
    icon: "/home/why-skip.png",
    title: "Skip the freelancer hunt",
    body: "Stop searching for the right person every time you need something done.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen w-full bg-[#F7F4F1]">
      <main
        id="main-content"
        className="mx-auto w-full max-w-[1140px] overflow-hidden bg-[#F7F4F1]"
      >
        <HomeHeader />

        {/* Hero */}
        <section className="relative mt-[100px] ml-[73px] h-[674px] w-[993px] origin-top-left max-[1179px]:ml-10 max-[1179px]:h-[540px] max-[1179px]:scale-80 max-[929px]:ml-6 max-[929px]:h-[450px] max-[929px]:scale-[0.66] max-[767px]:mx-5 max-[767px]:mt-8 max-[767px]:flex max-[767px]:h-auto max-[767px]:w-auto max-[767px]:scale-100 max-[767px]:flex-col max-[767px]:gap-6">
          <div className="absolute top-[34px] left-[626px] h-[640px] w-[367px] max-[767px]:static max-[767px]:order-4 max-[767px]:mb-[-240px] max-[767px]:ml-[115px] max-[767px]:origin-top-left max-[767px]:scale-60">
            <Image
              src="/home/hero-blob.svg"
              alt=""
              width={343}
              height={545}
              className="absolute top-[68px] left-0 h-[545px] w-[343px]"
            />
            <div className="absolute top-0 left-[7px] h-[640px] w-[360px] bg-[url('/home/hero-unicorn.webp')] [background-size:147.369%_110.781%] [background-position:83.426%_20.29%] bg-no-repeat" />
            <div className="absolute top-[471px] left-[-190px] h-[100px] w-[217px]">
              <div className="absolute top-[50px] left-[157px] h-[30px] w-[60px] bg-[url('/home/hero-scribble-small.png')] bg-cover bg-center bg-no-repeat" />
              <div className="absolute top-0 left-0 h-[100px] w-[172px] bg-[url('/home/hero-scribble.png')] bg-cover bg-center bg-no-repeat" />
            </div>
          </div>
          <div className="absolute top-0 left-0 h-[120px] w-[166px] bg-[url('/home/hero-badge.png')] bg-cover bg-center bg-no-repeat max-[767px]:static max-[767px]:order-1" />
          <div className="absolute top-[535px] left-6 h-[139px] w-[357px] bg-[url('/home/hero-paper.png')] bg-cover bg-center bg-no-repeat max-[767px]:static max-[767px]:order-3 max-[767px]:h-[110px] max-[767px]:w-[283px]" />
          <div className="absolute top-[133px] left-[23px] flex h-80 w-[366px] flex-col items-start justify-between max-[767px]:static max-[767px]:order-2 max-[767px]:h-auto max-[767px]:w-auto max-[767px]:justify-start max-[767px]:gap-5">
            <h1
              className={`flex w-[298px] flex-col items-start gap-1 ${displayFont} text-[64px] font-extrabold max-[767px]:text-[44px]`}
            >
              <span className="leading-[64px] whitespace-pre-line text-[#2B2D33] max-[767px]:leading-[46px]">
                {"Creative\nthat hits"}
              </span>
              <span className="leading-[60px] text-[#FF6426] max-[767px]:leading-[46px]">
                different.
              </span>
            </h1>
            <p className="text-base leading-6 whitespace-pre-line text-black">
              {
                "Unlimited creative requests. Fast turnaround.\nTop creative talent. One simple subscription."
              }
            </p>
            <div className="flex h-10 flex-row items-center gap-7 max-[767px]:h-auto max-[767px]:flex-col max-[767px]:items-start max-[767px]:gap-4">
              <Link
                href="/#how-it-works"
                className="font-brand flex h-10 w-[170px] flex-row items-center justify-center gap-2.5 rounded-[10px] bg-[#1F2024] px-5 py-2.5 text-center text-xl leading-none font-bold whitespace-nowrap text-white transition-colors hover:bg-[#FF6426]"
              >
                How it works?
              </Link>
              <Link
                href="/coming-soon"
                className="flex flex-row items-center gap-[9px] transition-opacity hover:opacity-75"
              >
                <span className="text-xl leading-[30px] font-bold whitespace-nowrap text-[#2B2D33]">
                  Explore Plans
                </span>
                <Image
                  src="/home/arrow-orange.svg"
                  alt=""
                  width={22.4}
                  height={17.58}
                  className="mt-0.5"
                />
              </Link>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="mt-[37px] flex h-[329px] w-full flex-row items-center justify-center gap-[116px] bg-white max-[929px]:h-auto max-[929px]:flex-wrap max-[929px]:gap-8 max-[929px]:px-6 max-[929px]:py-10 max-[767px]:flex-col max-[767px]:items-start max-[767px]:gap-7"
        >
          <div className="flex w-[175px] shrink-0 flex-col items-start gap-6">
            <h2
              className={`${displayFont} text-4xl leading-9 font-extrabold whitespace-pre-line text-[#2B2D33]`}
            >
              {"How it\nworks?"}
            </h2>
            <p className="text-xl leading-[30px] font-bold text-[#FF6426]">
              3 bites! That&rsquo;s it.
            </p>
          </div>
          <div className="flex w-[666px] shrink-0 flex-row items-start justify-center gap-5 max-[767px]:h-auto max-[767px]:w-auto max-[767px]:flex-col max-[767px]:items-start max-[767px]:gap-6">
            {STEPS.map((step, i) => (
              <div key={step.title} className="contents">
                {i > 0 && (
                  <Image
                    src="/home/step-arrow.png"
                    alt=""
                    width={67}
                    height={10}
                    className="mt-[111px] shrink-0 max-[767px]:hidden"
                  />
                )}
                <div
                  className={`${step.width} flex shrink-0 flex-col items-start max-[767px]:w-auto max-[767px]:max-w-80`}
                >
                  <Image src={step.icon} alt="" width={100} height={100} />
                  <h3
                    className={`mt-px ${displayFont} text-base leading-5 font-bold whitespace-nowrap text-[#2B2D33]`}
                  >
                    {step.title}
                  </h3>
                  <p className="mt-[15px] text-sm leading-6 text-[#5E616E]">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Fresh work */}
        <section className="relative flex h-[329px] w-full flex-row items-center justify-center gap-5 bg-[#12131A] max-[1139px]:h-auto max-[1139px]:flex-wrap max-[1139px]:gap-8 max-[1139px]:px-6 max-[1139px]:py-10">
          <div className="flex w-[275px] shrink-0 flex-col items-start gap-5">
            <h2
              className={`flex flex-col items-start self-stretch ${displayFont} text-4xl leading-9 font-extrabold`}
            >
              <span className="text-[#F7F4F1]">Fresh work.</span>
              <span className="text-[#8D5BFF]">No stale pixels.</span>
            </h2>
            <p className="text-sm leading-5 text-[#B8BAC2]">
              A quick look at what brands ship with Brandbite.
            </p>
          </div>
          <div className="flex h-[250px] w-[800px] flex-row items-center max-[1139px]:h-auto max-[1139px]:w-auto max-[1139px]:flex-wrap max-[1139px]:justify-center">
            {WORKS.map((src) => (
              <div key={src} className="relative h-[250px] w-[200px] shrink-0 overflow-hidden">
                <Image
                  src={src}
                  alt="Brandbite client work sample"
                  fill
                  sizes="200px"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
          <div className="absolute top-[242px] left-[196px] h-[60px] w-[121px] bg-[url('/home/works-arrow.png')] bg-cover bg-center bg-no-repeat max-[1139px]:hidden" />
        </section>

        {/* Why Brandbite */}
        <section className="flex h-[329px] w-full flex-row items-center justify-center gap-10 bg-white max-[1139px]:h-auto max-[1139px]:flex-wrap max-[1139px]:gap-8 max-[1139px]:px-6 max-[1139px]:py-10">
          <div className="flex w-[200px] shrink-0 flex-col items-start gap-6">
            <h2
              className={`${displayFont} text-4xl leading-9 font-extrabold whitespace-pre-line text-[#2B2D33]`}
            >
              {"Why\nBrandbite?"}
            </h2>
            <div className="h-[100px] w-[214px] bg-[url('/home/why-doodle.png')] bg-cover bg-center bg-no-repeat" />
          </div>
          <div className="flex w-[700px] flex-row items-start justify-center gap-5 max-[1139px]:h-auto max-[1139px]:w-auto max-[1139px]:flex-wrap max-[1139px]:justify-center">
            {WHY_ITEMS.map((item) => (
              <div
                key={item.title}
                className="flex min-h-[242px] w-40 flex-col items-start gap-[5px] border-r-[0.5px] border-[#D7D8DD] max-[767px]:w-[150px] max-[767px]:border-r-0"
              >
                <Image src={item.icon} alt="" width={100} height={100} className="shrink-0" />
                <h3
                  className={`w-[150px] ${displayFont} text-base leading-5 font-bold text-[#2B2D33]`}
                >
                  {item.title}
                </h3>
                <p className="w-[150px] text-sm leading-6 text-[#5E616E]">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Ready CTA */}
        <section className="relative h-[309px] w-full overflow-hidden bg-[#B696FF] max-[767px]:flex max-[767px]:h-auto max-[767px]:flex-col max-[767px]:gap-6 max-[767px]:px-5 max-[767px]:pt-10">
          <div className="absolute top-[60px] left-[54px] flex w-[400px] flex-col items-start gap-6 max-[767px]:static max-[767px]:w-auto">
            <h2 className={`${displayFont} text-4xl leading-9 font-extrabold text-[#2B2D33]`}>
              Ready to feed your brand better creative?
            </h2>
            <p className="text-sm leading-5 text-[#5E616E]">
              Send your first request and let Brandbite turn it into something worth shipping.
            </p>
            <Link
              href="/coming-soon"
              className="flex flex-row items-center gap-[9px] transition-opacity hover:opacity-85"
            >
              <span className="text-xl leading-[30px] font-bold whitespace-nowrap text-white">
                Get Started
              </span>
              <Image
                src="/home/arrow-orange.svg"
                alt=""
                width={22.4}
                height={17.58}
                className="mt-0.5"
              />
            </Link>
          </div>
          <Image
            src="/home/paper-plane.png"
            alt=""
            width={230}
            height={230}
            className="absolute top-[190px] left-[276px] w-[230px] max-[1023px]:hidden"
          />
          <div className="absolute top-0 left-[45%] h-[309px] w-[350px] bg-[url('/home/unicorn-wave.webp')] [background-size:119.857%_135.761%] [background-position:50%_18.552%] bg-no-repeat max-[1023px]:right-0 max-[1023px]:left-auto max-[767px]:static max-[767px]:order-5 max-[767px]:h-[265px] max-[767px]:w-[300px] max-[767px]:self-center" />
          <Image
            src="/home/ready-note.png"
            alt=""
            width={205}
            height={205}
            className="absolute top-[82px] right-[55px] w-[205px] max-[1023px]:hidden max-[767px]:static max-[767px]:block max-[767px]:w-60"
          />
        </section>

        <HomeFooter />
        <div className="h-5" />
      </main>
    </div>
  );
}
